# Runtime Adapters

Optional capability adapters you register on the runtime `adapters` map: attachments, text to speech, dictation, suggestions, and thread history persistence.

## Contents

- [The adapters map](#the-adapters-map)
- [Attachment adapters](#attachment-adapters)
- [Built-in attachment adapters](#built-in-attachment-adapters)
- [Custom attachment adapter](#custom-attachment-adapter)
- [Async generator upload lifecycle](#async-generator-upload-lifecycle)
- [CloudFileAttachmentAdapter](#cloudfileattachmentadapter)
- [Attachment error handling](#attachment-error-handling)
- [Text to speech](#text-to-speech)
- [Custom TTS adapter](#custom-tts-adapter)
- [Dictation](#dictation)
- [Custom dictation adapter](#custom-dictation-adapter)
- [Suggestion adapter](#suggestion-adapter)
- [Thread history adapter](#thread-history-adapter)

## The adapters map

Every adapter is registered under a named key on the runtime's `adapters` option. The same map works across runtime factories (`useChatRuntime`, `useLocalRuntime`, `useAISDKRuntime`).

```ts
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime({
  adapters: {
    attachments: /* AttachmentAdapter */,
    speech: /* SpeechSynthesisAdapter */,
    dictation: /* DictationAdapter */,
    suggestion: /* SuggestionAdapter */,
    history: /* ThreadHistoryAdapter */,
  },
});
```

## Attachment adapters

An `AttachmentAdapter` controls which files the composer accepts and how they are turned into message content. The interface from `@assistant-ui/react`:

```ts
import type {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
  Attachment,
} from "@assistant-ui/react";

type AttachmentAdapter = {
  accept: string;
  add: (state: { file: File }) =>
    | Promise<PendingAttachment>
    | AsyncGenerator<PendingAttachment, void>;
  send: (attachment: PendingAttachment) => Promise<CompleteAttachment>;
  remove: (attachment: Attachment) => Promise<void>;
};
```

`accept` is a MIME type filter string, the same syntax as the HTML `accept` attribute (`"image/*"`, `"image/jpeg,image/png"`, or `"*"` for any file). `add` validates the chosen file and produces a `PendingAttachment`; `send` runs at composer send time and resolves to a `CompleteAttachment` carrying the `content` array that becomes part of the message; `remove` cleans up.

The two statuses that flow through the lifecycle:

```ts
// add() typically returns a pending attachment that still needs sending
status: { type: "requires-action", reason: "composer-send" }
// send() returns the final, message-ready attachment
status: { type: "complete" }
```

## Built-in attachment adapters

Three adapters ship from `@assistant-ui/react`. `SimpleImageAttachmentAdapter` accepts `image/*` and converts files to data URLs, `SimpleTextAttachmentAdapter` accepts text files and wraps their content, and `CompositeAttachmentAdapter` combines several adapters and routes each file to the first one whose `accept` matches.

```ts
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
} from "@assistant-ui/react";

const runtime = useChatRuntime({
  adapters: {
    attachments: new CompositeAttachmentAdapter([
      new SimpleImageAttachmentAdapter(),
      new SimpleTextAttachmentAdapter(),
    ]),
  },
});
```

To restrict to images only, register the single adapter directly:

```ts
const runtime = useChatRuntime({
  adapters: {
    attachments: new SimpleImageAttachmentAdapter(),
  },
});
```

## Custom attachment adapter

Implement `AttachmentAdapter` to control validation and the content shape. This vision adapter rejects oversized images and emits an inline image content part.

```ts
import {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
} from "@assistant-ui/react";

class VisionImageAdapter implements AttachmentAdapter {
  accept = "image/jpeg,image/png,image/webp,image/gif";

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Image size exceeds 20MB limit");
    return {
      id: crypto.randomUUID(),
      type: "image",
      name: file.name,
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const base64 = await this.fileToBase64DataURL(attachment.file);
    return {
      id: attachment.id,
      type: "image",
      name: attachment.name,
      content: [{ type: "image", image: base64 }],
      status: { type: "complete" },
    };
  }

  async remove(attachment: PendingAttachment): Promise<void> {}

  private async fileToBase64DataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
```

Register it with any runtime:

```ts
import { useLocalRuntime } from "@assistant-ui/react";

const runtime = useLocalRuntime(MyModelAdapter, {
  adapters: {
    attachments: new VisionImageAdapter(),
  },
});
```

## Async generator upload lifecycle

When `add` is an async generator it can yield intermediate `PendingAttachment` states, which is how you surface upload progress. A `running` status carries a `progress` number; yield the final `requires-action` state once the file is uploaded so it is ready to send.

```ts
class ServerUploadAdapter implements AttachmentAdapter {
  accept = "*";
  private urls = new Map<string, string>();

  async *add({ file }: { file: File }) {
    const id = crypto.randomUUID();
    yield {
      id, type: "file" as const, name: file.name, file, contentType: file.type,
      status: { type: "running" as const, reason: "uploading" as const, progress: 0 },
    };

    const form = new FormData();
    form.append("file", file);
    const { url } = await fetch("/api/upload", { method: "POST", body: form }).then((r) => r.json());
    this.urls.set(id, url);

    yield {
      id, type: "file" as const, name: file.name, file, contentType: file.type,
      status: { type: "requires-action" as const, reason: "composer-send" as const },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const url = this.urls.get(attachment.id)!;
    this.urls.delete(attachment.id);
    return {
      ...attachment,
      status: { type: "complete" },
      content: [{ type: "file", data: url, mimeType: attachment.contentType ?? "", filename: attachment.name }],
    };
  }

  async remove() {}
}
```

This pattern avoids holding large files in memory as base64: the file is uploaded during `add`, and `send` only forwards the resulting URL into the message content.

## CloudFileAttachmentAdapter

`CloudFileAttachmentAdapter` stores attachments in assistant-ui Cloud. Pass an `AssistantCloud` instance to the constructor; it supplies its own `accept`, `add`, `send`, and `remove` defaults.

```ts
import { CloudFileAttachmentAdapter } from "@assistant-ui/react";
import { AssistantCloud } from "@assistant-ui/react";

const cloud = new AssistantCloud({ /* ... */ });

const runtime = useChatRuntime({
  adapters: {
    attachments: new CloudFileAttachmentAdapter(cloud),
  },
});
```

## Attachment error handling

Failures surface as the `composer.attachmentAddError` event rather than throwing into the render tree. Subscribe with `useAuiEvent` and branch on `reason`.

```tsx
import { useAuiEvent } from "@assistant-ui/react";

function AttachmentErrorToast() {
  useAuiEvent("composer.attachmentAddError", ({ reason, message, error }) => {
    if (reason === "not-accepted") {
      toast.error("This file type is not supported.");
    } else if (reason === "no-adapter") {
      toast.error("Attachments are not configured for this composer.");
    } else {
      if (error) console.error(error);
      toast.error(message || "Attachment failed to upload.");
    }
  });
  return null;
}
```

`no-adapter` means no `AttachmentAdapter` was configured, `not-accepted` means the file type did not match `adapter.accept`, and `adapter-error` means `add()` threw or returned an error status.

## Text to speech

Register a `SpeechSynthesisAdapter` under `adapters.speech`. The built-in `WebSpeechSynthesisAdapter` uses the browser's native Web Speech API.

```ts
import { WebSpeechSynthesisAdapter } from "@assistant-ui/react";

const runtime = useChatRuntime({
  adapters: {
    speech: new WebSpeechSynthesisAdapter(),
  },
});
```

`ActionBarPrimitive.Speak` is automatically disabled when no speech adapter is configured. Toggle speak and stop buttons off the message's `speech` state, which is `undefined` unless this message is the one being spoken.

```tsx
import { ActionBarPrimitive, useAuiState } from "@assistant-ui/react";
import { AudioLinesIcon, StopCircleIcon } from "lucide-react";

const AssistantActionBar = () => {
  const isSpeaking = useAuiState((s) => s.message.speech != null);
  return (
    <ActionBarPrimitive.Root>
      {!isSpeaking && (
        <ActionBarPrimitive.Speak>
          <AudioLinesIcon />
        </ActionBarPrimitive.Speak>
      )}
      {isSpeaking && (
        <ActionBarPrimitive.StopSpeaking>
          <StopCircleIcon />
        </ActionBarPrimitive.StopSpeaking>
      )}
      <ActionBarPrimitive.Copy />
    </ActionBarPrimitive.Root>
  );
};
```

## Custom TTS adapter

The interface is a single `speak` method that returns an `Utterance`. The utterance exposes a live `status`, a `cancel`, and a `subscribe` for change notifications.

```ts
import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

type SpeechSynthesisAdapter = {
  speak: (text: string) => SpeechSynthesisAdapter.Utterance;
};

type Utterance = {
  status: SpeechSynthesisAdapter.Status;
  cancel: () => void;
  subscribe: (callback: () => void) => Unsubscribe;
};

type Status =
  | { type: "starting" | "running" }
  | { type: "ended"; reason: "finished" | "cancelled" | "error"; error?: unknown };
```

A custom adapter that fetches audio from an external endpoint and plays it through an `HTMLAudioElement`:

```ts
import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

export class CustomTTSAdapter implements SpeechSynthesisAdapter {
  private apiUrl: string;
  constructor(options: { apiUrl: string }) {
    this.apiUrl = options.apiUrl;
  }

  speak(text: string): SpeechSynthesisAdapter.Utterance {
    const subscribers = new Set<() => void>();
    let status: SpeechSynthesisAdapter.Status = { type: "starting" };
    let audio: HTMLAudioElement | null = null;

    const notify = () => { for (const cb of subscribers) cb(); };
    const finish = (reason: "finished" | "cancelled" | "error", error?: unknown) => {
      if (status.type === "ended") return;
      status = { type: "ended", reason, error };
      notify();
    };

    fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.blob())
      .then((blob) => {
        audio = new Audio(URL.createObjectURL(blob));
        status = { type: "running" };
        notify();
        audio.onended = () => finish("finished");
        audio.onerror = (e) => finish("error", e);
        audio.play();
      })
      .catch((err) => finish("error", err));

    return {
      get status() { return status; },
      cancel: () => { audio?.pause(); finish("cancelled"); },
      subscribe: (cb) => { subscribers.add(cb); return () => subscribers.delete(cb); },
    };
  }
}
```

Register it under `adapters.speech` exactly like the built-in adapter.

## Dictation

Register a `DictationAdapter` under `adapters.dictation` for speech to text input. The built-in `WebSpeechDictationAdapter` wraps the browser's Web Speech recognition API.

```ts
import { WebSpeechDictationAdapter } from "@assistant-ui/react";

const runtime = useChatRuntime({
  adapters: {
    dictation: new WebSpeechDictationAdapter({
      language: "en-US",
      continuous: true,
      interimResults: true,
    }),
  },
});
```

Check browser support before registering:

```ts
if (WebSpeechDictationAdapter.isSupported()) {
  // dictation available
}
```

The current interim transcript is available at `composer.dictation?.transcript`; `composer.dictation` is `null` when not dictating. Toggle the mic button with `AuiIf` on that value:

```tsx
import { AuiIf, ComposerPrimitive } from "@assistant-ui/react";
import { MicIcon, SquareIcon } from "lucide-react";

function DictationButton() {
  return (
    <>
      <AuiIf composer={{ dictation: false }}>
        <ComposerPrimitive.Dictate>
          <MicIcon />
        </ComposerPrimitive.Dictate>
      </AuiIf>
      <AuiIf composer={{ dictation: true }}>
        <ComposerPrimitive.StopDictation>
          <SquareIcon />
        </ComposerPrimitive.StopDictation>
      </AuiIf>
    </>
  );
}
```

## Custom dictation adapter

The interface exposes an optional `disableInputDuringDictation` flag and a `listen` method that returns a session.

```ts
import type { DictationAdapter } from "@assistant-ui/react";

type DictationAdapter = {
  disableInputDuringDictation?: boolean;
  listen: () => DictationAdapter.Session;
};

type Session = {
  status: { type: "starting" | "running" | "ended" };
  stop: () => Promise<void>;
  cancel: () => void;
  onSpeechStart: (cb: () => void) => Unsubscribe;
  onSpeechEnd: (cb: () => void) => Unsubscribe;
  onSpeech: (cb: (event: { transcript: string; isFinal?: boolean }) => void) => Unsubscribe;
};
```

`stop` finalizes results and `cancel` discards them. The `onSpeech` callback receives a transcript chunk: `isFinal: true` commits the text to the input, while `isFinal: false` shows it as a preview only.

Set `disableInputDuringDictation = true` when the underlying service returns cumulative transcripts that would conflict with simultaneous typing. The ElevenLabs Scribe adapter does this, and it registers the same way:

```ts
import { ElevenLabsScribeAdapter } from "./lib/elevenlabs-scribe-adapter";

const runtime = useChatRuntime({
  adapters: {
    dictation: new ElevenLabsScribeAdapter({
      tokenEndpoint: "/api/scribe-token",
      languageCode: "en",
      disableInputDuringDictation: true,
    }),
  },
});
```

## Suggestion adapter

A `SuggestionAdapter` generates follow up prompts shown in the thread. Its single `generate` method returns a list of `ThreadSuggestion`, either as a Promise or as an async generator for incremental delivery.

```ts
import type { SuggestionAdapter, ThreadSuggestion } from "@assistant-ui/react";

type SuggestionAdapter = {
  generate: (
    options: SuggestionAdapterGenerateOptions,
  ) =>
    | Promise<readonly ThreadSuggestion[]>
    | AsyncGenerator<readonly ThreadSuggestion[], void>;
};
```

Register it under `adapters.suggestion`:

```ts
const runtime = useChatRuntime({
  adapters: {
    suggestion: {
      generate: async (options) => {
        return [
          { prompt: "What can you help me with?" },
          { prompt: "Summarize this document" },
        ];
      },
    },
  },
});
```

Read the generated entries in the UI through `thread.suggestions`.

## Thread history adapter

A `ThreadHistoryAdapter` persists and restores thread messages. It exposes `load` and `append`, plus optional `resume` and `withFormat`.

```ts
type ThreadHistoryAdapter = {
  load: () => Promise<ExportedMessageRepository & { unstable_resume?: boolean }>;
  append: (item: ExportedMessageRepositoryItem) => Promise<void>;
  resume?: (
    options: ChatModelRunOptions,
  ) => AsyncGenerator<ChatModelRunResult, void, unknown>;
  withFormat?: <TMessage, TStorageFormat extends Record<string, unknown>>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ) => GenericThreadHistoryAdapter<TMessage>;
};
```

`load` returns the persisted repository (an optional `unstable_resume` flag triggers a resume on mount), `append` is called for each new message, `resume` follows the same `ChatModelRunOptions` to `AsyncGenerator` contract as a model run to restore an in progress generation, and `withFormat` adapts the storage shape. `withFormat` is required when used with `useAISDKRuntime` or `useChatRuntime`, which store messages in the AI SDK format.

```ts
const runtime = useLocalRuntime(chatModelAdapter, {
  adapters: {
    history: myHistoryAdapter,
  },
});
```

The repository payload `load` resolves to and `append` receives an item of:

```ts
type ExportedMessageRepository = {
  headId?: string | null;
  messages: Array<{
    message: ThreadMessage;
    parentId: string | null;
    runConfig?: RunConfig;
  }>;
};
```
