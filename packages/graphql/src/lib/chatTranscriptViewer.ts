import { STUDENT_TRANSCRIPT_FORMAT_VERSION } from './chatTranscriptExport.js'

// Self-contained page shipped inside every transcript archive. It opens one
// per-student JSON file chosen by the user, entirely in the browser: no
// network requests, no remote assets, no innerHTML. Student text is shown as
// plain text; assistant text goes through a small markdown renderer that
// builds DOM nodes, so stored content cannot inject markup. Links are shown
// as text and images are never loaded. Keep the script free of backticks and
// template placeholders because it lives inside a template literal.
const VIEWER_SCRIPT = `
(function () {
  var SUPPORTED_VERSION = ${STUDENT_TRANSCRIPT_FORMAT_VERSION};
  var root = document.getElementById('out');
  var status = document.getElementById('status');

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  var INLINE_SOURCE = /(\`[^\`]+\`)|(\\*\\*[^*]+\\*\\*)|(__[^_]+__)|(\\*[^*\\s][^*]*\\*)|(!\\[[^\\]]*\\]\\([^)]*\\))|(\\[[^\\]]*\\]\\([^)]*\\))/;

  function inline(parent, text) {
    var last = 0;
    var match;
    // a fresh regex per call: nested calls must not share lastIndex
    var pattern = new RegExp(INLINE_SOURCE.source, 'g');
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > last) parent.appendChild(document.createTextNode(text.slice(last, match.index)));
      var token = match[0];
      if (match[1]) {
        parent.appendChild(el('code', '', token.slice(1, -1)));
      } else if (match[2] || match[3]) {
        var strong = el('strong');
        inline(strong, token.slice(2, -2));
        parent.appendChild(strong);
      } else if (match[4]) {
        var em = el('em');
        inline(em, token.slice(1, -1));
        parent.appendChild(em);
      } else if (match[5]) {
        var alt = token.slice(2, token.indexOf(']'));
        parent.appendChild(document.createTextNode('[image: ' + alt + ']'));
      } else {
        var close = token.indexOf('](');
        var label = token.slice(1, close);
        var target = token.slice(close + 2, -1);
        parent.appendChild(document.createTextNode(label + ' (' + target + ')'));
      }
      last = match.index + token.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }

  function markdown(text) {
    var box = el('div', 'md');
    var lines = String(text).split(/\\r?\\n/);
    var paragraph = [];
    var list = null;
    var listTag = '';
    var i = 0;

    function flushParagraph() {
      if (!paragraph.length) return;
      var p = el('p');
      paragraph.forEach(function (line, index) {
        if (index > 0) p.appendChild(el('br'));
        inline(p, line);
      });
      box.appendChild(p);
      paragraph = [];
    }
    function flushList() {
      list = null;
      listTag = '';
    }

    while (i < lines.length) {
      var line = lines[i];
      var fence = /^\\s*(\`\`\`|~~~)/.exec(line);
      if (fence) {
        flushParagraph();
        flushList();
        var code = [];
        i += 1;
        while (i < lines.length && !/^\\s*(\`\`\`|~~~)/.test(lines[i])) {
          code.push(lines[i]);
          i += 1;
        }
        var pre = el('pre');
        pre.appendChild(el('code', '', code.join('\\n')));
        box.appendChild(pre);
        i += 1;
        continue;
      }
      var heading = /^(#{1,6})\\s+(.*)$/.exec(line);
      if (heading) {
        flushParagraph();
        flushList();
        var h = el('h' + Math.min(heading[1].length + 2, 6));
        inline(h, heading[2]);
        box.appendChild(h);
        i += 1;
        continue;
      }
      var item = /^\\s*([-*+]|\\d+\\.)\\s+(.*)$/.exec(line);
      if (item) {
        flushParagraph();
        var tag = /\\d/.test(item[1]) ? 'ol' : 'ul';
        if (!list || listTag !== tag) {
          list = el(tag);
          listTag = tag;
          box.appendChild(list);
        }
        var li = el('li');
        inline(li, item[2]);
        list.appendChild(li);
        i += 1;
        continue;
      }
      if (/^\\s*$/.test(line)) {
        flushParagraph();
        flushList();
      } else {
        flushList();
        paragraph.push(line);
      }
      i += 1;
    }
    flushParagraph();
    return box;
  }

  function identityLine(student) {
    var identity = student.identity || {};
    var name = [identity.givenName, identity.surname].filter(Boolean).join(' ');
    return [name, identity.matriculationNumber, identity.email, identity.username]
      .filter(Boolean)
      .join(' \\u00b7 ') || student.participantId || '';
  }

  function render(data) {
    root.textContent = '';
    var student = data.student || {};
    root.appendChild(el('h1', '', (data.chatbot && data.chatbot.name) || 'Chatbot'));
    root.appendChild(el('p', 'meta', 'Course: ' + ((data.course && data.course.name) || '') + ' \\u00b7 Exported ' + (data.exportedAt || '')));
    root.appendChild(el('h2', '', identityLine(student)));
    root.appendChild(el('p', 'meta', [student.rosterStatus, student.conversationStatus].filter(Boolean).join(' \\u00b7 ')));
    var threads = Array.isArray(data.threads) ? data.threads : [];
    if (!threads.length) root.appendChild(el('p', '', 'No conversation.'));
    threads.forEach(function (thread, t) {
      root.appendChild(el('h3', '', 'Conversation ' + (t + 1) + (thread.title ? ': ' + thread.title : '')));
      root.appendChild(el('p', 'meta', 'Started ' + thread.createdAt + (thread.hasBranches ? ' \\u00b7 contains edited or regenerated branches' : '')));
      (thread.messages || []).forEach(function (message) {
        var isUser = message.role === 'user';
        var box = el('div', 'msg ' + (isUser ? 'user' : 'assistant'));
        var meta = el('div', 'meta', (isUser ? 'Student' : 'Assistant') + ' \\u00b7 ' + message.createdAt + (thread.hasBranches ? ' \\u00b7 branch ' + message.branch : ''));
        if (message.status && message.status !== 'complete') {
          meta.appendChild(document.createTextNode(' \\u00b7 '));
          meta.appendChild(el('strong', 'flag', message.status));
        }
        if (message.attachments && message.attachments.length) {
          meta.appendChild(document.createTextNode(' \\u00b7 attachments: ' + message.attachments.join(', ')));
        }
        box.appendChild(meta);
        box.appendChild(isUser ? el('div', 'plain', message.text) : markdown(message.text));
        root.appendChild(box);
      });
    });
  }

  document.getElementById('file').addEventListener('change', function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    status.textContent = '';
    file.text().then(function (text) {
      var data;
      try {
        data = JSON.parse(text);
      } catch (error) {
        throw new Error('This file is not valid JSON.');
      }
      if (!data || data.formatVersion !== SUPPORTED_VERSION) {
        throw new Error('Unsupported format version. This viewer reads version ' + SUPPORTED_VERSION + '.');
      }
      render(data);
    }).catch(function (error) {
      root.textContent = '';
      status.textContent = error.message;
    });
  });
})();
`

export const CHAT_TRANSCRIPT_VIEWER_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chat transcript viewer</title>
<style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;line-height:1.5}.meta{color:#555;font-size:.85rem}.msg{border-left:3px solid #ccc;margin:.75rem 0;padding:.25rem .75rem}.msg.user{border-color:#0b5394}.plain{white-space:pre-wrap}pre{background:#f4f4f4;padding:.5rem;overflow:auto}code{background:#f4f4f4}pre code{background:none}#status{color:#b00020}.flag{color:#b00020}</style>
</head><body>
<h1>Chat transcript viewer</h1>
<p>Open one student file (JSON) from the <code>students</code> folder of this archive. Nothing leaves your computer.</p>
<p><input type="file" id="file" accept=".json,application/json"></p>
<p id="status" role="alert"></p>
<div id="out"></div>
<script>${VIEWER_SCRIPT}</script>
</body></html>
`
