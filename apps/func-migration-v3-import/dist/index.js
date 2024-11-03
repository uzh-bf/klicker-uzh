var __create = Object.create;
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b2) => {
  for (var prop in b2 || (b2 = {}))
    if (__hasOwnProp.call(b2, prop))
      __defNormalProp(a, prop, b2[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b2)) {
      if (__propIsEnum.call(b2, prop))
        __defNormalProp(a, prop, b2[prop]);
    }
  return a;
};
var __spreadProps = (a, b2) => __defProps(a, __getOwnPropDescs(b2));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to2, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to2, key) && key !== except)
        __defProp(to2, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to2;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x2) => x2.done ? resolve(x2.value) : Promise.resolve(x2.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// ../../packages/prisma/dist/runtime/library.js
var require_library = __commonJS({
  "../../packages/prisma/dist/runtime/library.js"(exports, module) {
    "use strict";
    var zl = Object.create;
    var Lr = Object.defineProperty;
    var Yl = Object.getOwnPropertyDescriptor;
    var Zl = Object.getOwnPropertyNames;
    var Xl = Object.getPrototypeOf;
    var eu = Object.prototype.hasOwnProperty;
    var Z = (e, t) => () => (t || e((t = { exports: {} }).exports, t), t.exports);
    var Vt = (e, t) => {
      for (var r in t) Lr(e, r, { get: t[r], enumerable: true });
    };
    var mo = (e, t, r, n) => {
      if (t && typeof t == "object" || typeof t == "function") for (let i of Zl(t)) !eu.call(e, i) && i !== r && Lr(e, i, { get: () => t[i], enumerable: !(n = Yl(t, i)) || n.enumerable });
      return e;
    };
    var k = (e, t, r) => (r = e != null ? zl(Xl(e)) : {}, mo(t || !e || !e.__esModule ? Lr(r, "default", { value: e, enumerable: true }) : r, e));
    var tu = (e) => mo(Lr({}, "__esModule", { value: true }), e);
    var Mo = Z((af, Yn) => {
      "use strict";
      var v = Yn.exports;
      Yn.exports.default = v;
      var D = "\x1B[", Jt = "\x1B]", ft = "\x07", Qr = ";", No = process.env.TERM_PROGRAM === "Apple_Terminal";
      v.cursorTo = (e, t) => {
        if (typeof e != "number") throw new TypeError("The `x` argument is required");
        return typeof t != "number" ? D + (e + 1) + "G" : D + (t + 1) + ";" + (e + 1) + "H";
      };
      v.cursorMove = (e, t) => {
        if (typeof e != "number") throw new TypeError("The `x` argument is required");
        let r = "";
        return e < 0 ? r += D + -e + "D" : e > 0 && (r += D + e + "C"), t < 0 ? r += D + -t + "A" : t > 0 && (r += D + t + "B"), r;
      };
      v.cursorUp = (e = 1) => D + e + "A";
      v.cursorDown = (e = 1) => D + e + "B";
      v.cursorForward = (e = 1) => D + e + "C";
      v.cursorBackward = (e = 1) => D + e + "D";
      v.cursorLeft = D + "G";
      v.cursorSavePosition = No ? "\x1B7" : D + "s";
      v.cursorRestorePosition = No ? "\x1B8" : D + "u";
      v.cursorGetPosition = D + "6n";
      v.cursorNextLine = D + "E";
      v.cursorPrevLine = D + "F";
      v.cursorHide = D + "?25l";
      v.cursorShow = D + "?25h";
      v.eraseLines = (e) => {
        let t = "";
        for (let r = 0; r < e; r++) t += v.eraseLine + (r < e - 1 ? v.cursorUp() : "");
        return e && (t += v.cursorLeft), t;
      };
      v.eraseEndLine = D + "K";
      v.eraseStartLine = D + "1K";
      v.eraseLine = D + "2K";
      v.eraseDown = D + "J";
      v.eraseUp = D + "1J";
      v.eraseScreen = D + "2J";
      v.scrollUp = D + "S";
      v.scrollDown = D + "T";
      v.clearScreen = "\x1Bc";
      v.clearTerminal = process.platform === "win32" ? `${v.eraseScreen}${D}0f` : `${v.eraseScreen}${D}3J${D}H`;
      v.beep = ft;
      v.link = (e, t) => [Jt, "8", Qr, Qr, t, ft, e, Jt, "8", Qr, Qr, ft].join("");
      v.image = (e, t = {}) => {
        let r = `${Jt}1337;File=inline=1`;
        return t.width && (r += `;width=${t.width}`), t.height && (r += `;height=${t.height}`), t.preserveAspectRatio === false && (r += ";preserveAspectRatio=0"), r + ":" + e.toString("base64") + ft;
      };
      v.iTerm = { setCwd: (e = process.cwd()) => `${Jt}50;CurrentDir=${e}${ft}`, annotation: (e, t = {}) => {
        let r = `${Jt}1337;`, n = typeof t.x < "u", i = typeof t.y < "u";
        if ((n || i) && !(n && i && typeof t.length < "u")) throw new Error("`x`, `y` and `length` must be defined when `x` or `y` is defined");
        return e = e.replace(/\|/g, ""), r += t.isHidden ? "AddHiddenAnnotation=" : "AddAnnotation=", t.length > 0 ? r += (n ? [e, t.length, t.x, t.y] : [t.length, e]).join("|") : r += e, r + ft;
      } };
    });
    var Zn = Z((lf, $o) => {
      "use strict";
      $o.exports = (e, t = process.argv) => {
        let r = e.startsWith("-") ? "" : e.length === 1 ? "-" : "--", n = t.indexOf(r + e), i = t.indexOf("--");
        return n !== -1 && (i === -1 || n < i);
      };
    });
    var Vo = Z((uf, jo) => {
      "use strict";
      var ju = require("os"), qo = require("tty"), de = Zn(), { env: Q } = process, Qe;
      de("no-color") || de("no-colors") || de("color=false") || de("color=never") ? Qe = 0 : (de("color") || de("colors") || de("color=true") || de("color=always")) && (Qe = 1);
      "FORCE_COLOR" in Q && (Q.FORCE_COLOR === "true" ? Qe = 1 : Q.FORCE_COLOR === "false" ? Qe = 0 : Qe = Q.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(Q.FORCE_COLOR, 10), 3));
      function Xn(e) {
        return e === 0 ? false : { level: e, hasBasic: true, has256: e >= 2, has16m: e >= 3 };
      }
      function ei(e, t) {
        if (Qe === 0) return 0;
        if (de("color=16m") || de("color=full") || de("color=truecolor")) return 3;
        if (de("color=256")) return 2;
        if (e && !t && Qe === void 0) return 0;
        let r = Qe || 0;
        if (Q.TERM === "dumb") return r;
        if (process.platform === "win32") {
          let n = ju.release().split(".");
          return Number(n[0]) >= 10 && Number(n[2]) >= 10586 ? Number(n[2]) >= 14931 ? 3 : 2 : 1;
        }
        if ("CI" in Q) return ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "GITHUB_ACTIONS", "BUILDKITE"].some((n) => n in Q) || Q.CI_NAME === "codeship" ? 1 : r;
        if ("TEAMCITY_VERSION" in Q) return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(Q.TEAMCITY_VERSION) ? 1 : 0;
        if (Q.COLORTERM === "truecolor") return 3;
        if ("TERM_PROGRAM" in Q) {
          let n = parseInt((Q.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
          switch (Q.TERM_PROGRAM) {
            case "iTerm.app":
              return n >= 3 ? 3 : 2;
            case "Apple_Terminal":
              return 2;
          }
        }
        return /-256(color)?$/i.test(Q.TERM) ? 2 : /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(Q.TERM) || "COLORTERM" in Q ? 1 : r;
      }
      function Vu(e) {
        let t = ei(e, e && e.isTTY);
        return Xn(t);
      }
      jo.exports = { supportsColor: Vu, stdout: Xn(ei(true, qo.isatty(1))), stderr: Xn(ei(true, qo.isatty(2))) };
    });
    var Go = Z((cf, Uo) => {
      "use strict";
      var Bu = Vo(), gt = Zn();
      function Bo(e) {
        if (/^\d{3,4}$/.test(e)) {
          let r = /(\d{1,2})(\d{2})/.exec(e);
          return { major: 0, minor: parseInt(r[1], 10), patch: parseInt(r[2], 10) };
        }
        let t = (e || "").split(".").map((r) => parseInt(r, 10));
        return { major: t[0], minor: t[1], patch: t[2] };
      }
      function ti(e) {
        let { env: t } = process;
        if ("FORCE_HYPERLINK" in t) return !(t.FORCE_HYPERLINK.length > 0 && parseInt(t.FORCE_HYPERLINK, 10) === 0);
        if (gt("no-hyperlink") || gt("no-hyperlinks") || gt("hyperlink=false") || gt("hyperlink=never")) return false;
        if (gt("hyperlink=true") || gt("hyperlink=always") || "NETLIFY" in t) return true;
        if (!Bu.supportsColor(e) || e && !e.isTTY || process.platform === "win32" || "CI" in t || "TEAMCITY_VERSION" in t) return false;
        if ("TERM_PROGRAM" in t) {
          let r = Bo(t.TERM_PROGRAM_VERSION);
          switch (t.TERM_PROGRAM) {
            case "iTerm.app":
              return r.major === 3 ? r.minor >= 1 : r.major > 3;
            case "WezTerm":
              return r.major >= 20200620;
            case "vscode":
              return r.major > 1 || r.major === 1 && r.minor >= 72;
          }
        }
        if ("VTE_VERSION" in t) {
          if (t.VTE_VERSION === "0.50.0") return false;
          let r = Bo(t.VTE_VERSION);
          return r.major > 0 || r.minor >= 50;
        }
        return false;
      }
      Uo.exports = { supportsHyperlink: ti, stdout: ti(process.stdout), stderr: ti(process.stderr) };
    });
    var Jo = Z((pf, Wt) => {
      "use strict";
      var Uu = Mo(), ri = Go(), Qo = (e, t, _a7 = {}) => {
        var _b2 = _a7, { target: r = "stdout" } = _b2, n = __objRest(_b2, ["target"]);
        return ri[r] ? Uu.link(e, t) : n.fallback === false ? e : typeof n.fallback == "function" ? n.fallback(e, t) : `${e} (\u200B${t}\u200B)`;
      };
      Wt.exports = (e, t, r = {}) => Qo(e, t, r);
      Wt.exports.stderr = (e, t, r = {}) => Qo(e, t, __spreadValues({ target: "stderr" }, r));
      Wt.exports.isSupported = ri.stdout;
      Wt.exports.stderr.isSupported = ri.stderr;
    });
    var ii = Z((xf, Gu) => {
      Gu.exports = { name: "@prisma/engines-version", version: "5.21.0-36.08713a93b99d58f31485621c634b04983ae01d95", main: "index.js", types: "index.d.ts", license: "Apache-2.0", author: "Tim Suchanek <suchanek@prisma.io>", prisma: { enginesVersion: "08713a93b99d58f31485621c634b04983ae01d95" }, repository: { type: "git", url: "https://github.com/prisma/engines-wrapper.git", directory: "packages/engines-version" }, devDependencies: { "@types/node": "18.19.34", typescript: "4.9.5" }, files: ["index.js", "index.d.ts"], scripts: { build: "tsc -d" } };
    });
    var oi = Z((Jr) => {
      "use strict";
      Object.defineProperty(Jr, "__esModule", { value: true });
      Jr.enginesVersion = void 0;
      Jr.enginesVersion = ii().prisma.enginesVersion;
    });
    var zo = Z((jf, Wu) => {
      Wu.exports = { name: "dotenv", version: "16.0.3", description: "Loads environment variables from .env file", main: "lib/main.js", types: "lib/main.d.ts", exports: { ".": { require: "./lib/main.js", types: "./lib/main.d.ts", default: "./lib/main.js" }, "./config": "./config.js", "./config.js": "./config.js", "./lib/env-options": "./lib/env-options.js", "./lib/env-options.js": "./lib/env-options.js", "./lib/cli-options": "./lib/cli-options.js", "./lib/cli-options.js": "./lib/cli-options.js", "./package.json": "./package.json" }, scripts: { "dts-check": "tsc --project tests/types/tsconfig.json", lint: "standard", "lint-readme": "standard-markdown", pretest: "npm run lint && npm run dts-check", test: "tap tests/*.js --100 -Rspec", prerelease: "npm test", release: "standard-version" }, repository: { type: "git", url: "git://github.com/motdotla/dotenv.git" }, keywords: ["dotenv", "env", ".env", "environment", "variables", "config", "settings"], readmeFilename: "README.md", license: "BSD-2-Clause", devDependencies: { "@types/node": "^17.0.9", decache: "^4.6.1", dtslint: "^3.7.0", sinon: "^12.0.1", standard: "^16.0.4", "standard-markdown": "^7.1.0", "standard-version": "^9.3.2", tap: "^15.1.6", tar: "^6.1.11", typescript: "^4.5.4" }, engines: { node: ">=12" } };
    });
    var Zo = Z((Vf, Hr) => {
      "use strict";
      var Hu = require("fs"), Yo = require("path"), Ku = require("os"), zu = zo(), Yu = zu.version, Zu = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
      function Xu(e) {
        let t = {}, r = e.toString();
        r = r.replace(/\r\n?/mg, `
`);
        let n;
        for (; (n = Zu.exec(r)) != null; ) {
          let i = n[1], o = n[2] || "";
          o = o.trim();
          let s = o[0];
          o = o.replace(/^(['"`])([\s\S]*)\1$/mg, "$2"), s === '"' && (o = o.replace(/\\n/g, `
`), o = o.replace(/\\r/g, "\r")), t[i] = o;
        }
        return t;
      }
      function ui(e) {
        console.log(`[dotenv@${Yu}][DEBUG] ${e}`);
      }
      function ec(e) {
        return e[0] === "~" ? Yo.join(Ku.homedir(), e.slice(1)) : e;
      }
      function tc(e) {
        let t = Yo.resolve(process.cwd(), ".env"), r = "utf8", n = !!(e && e.debug), i = !!(e && e.override);
        e && (e.path != null && (t = ec(e.path)), e.encoding != null && (r = e.encoding));
        try {
          let o = Wr.parse(Hu.readFileSync(t, { encoding: r }));
          return Object.keys(o).forEach(function(s) {
            Object.prototype.hasOwnProperty.call(process.env, s) ? (i === true && (process.env[s] = o[s]), n && ui(i === true ? `"${s}" is already defined in \`process.env\` and WAS overwritten` : `"${s}" is already defined in \`process.env\` and was NOT overwritten`)) : process.env[s] = o[s];
          }), { parsed: o };
        } catch (o) {
          return n && ui(`Failed to load ${t} ${o.message}`), { error: o };
        }
      }
      var Wr = { config: tc, parse: Xu };
      Hr.exports.config = Wr.config;
      Hr.exports.parse = Wr.parse;
      Hr.exports = Wr;
    });
    var is = Z((Hf, ns) => {
      "use strict";
      ns.exports = (e) => {
        let t = e.match(/^[ \t]*(?=\S)/gm);
        return t ? t.reduce((r, n) => Math.min(r, n.length), 1 / 0) : 0;
      };
    });
    var ss = Z((Kf, os) => {
      "use strict";
      var oc = is();
      os.exports = (e) => {
        let t = oc(e);
        if (t === 0) return e;
        let r = new RegExp(`^[ \\t]{${t}}`, "gm");
        return e.replace(r, "");
      };
    });
    var mi = Z((tg, as) => {
      "use strict";
      as.exports = (e, t = 1, r) => {
        if (r = __spreadValues({ indent: " ", includeEmptyLines: false }, r), typeof e != "string") throw new TypeError(`Expected \`input\` to be a \`string\`, got \`${typeof e}\``);
        if (typeof t != "number") throw new TypeError(`Expected \`count\` to be a \`number\`, got \`${typeof t}\``);
        if (typeof r.indent != "string") throw new TypeError(`Expected \`options.indent\` to be a \`string\`, got \`${typeof r.indent}\``);
        if (t === 0) return e;
        let n = r.includeEmptyLines ? /^/gm : /^(?!\s*$)/gm;
        return e.replace(n, r.indent.repeat(t));
      };
    });
    var ps = Z((ig, cs) => {
      "use strict";
      cs.exports = ({ onlyFirst: e = false } = {}) => {
        let t = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"].join("|");
        return new RegExp(t, e ? void 0 : "g");
      };
    });
    var yi = Z((og, ds) => {
      "use strict";
      var mc = ps();
      ds.exports = (e) => typeof e == "string" ? e.replace(mc(), "") : e;
    });
    var ms = Z((lg, Yr) => {
      "use strict";
      Yr.exports = (e = {}) => {
        let t;
        if (e.repoUrl) t = e.repoUrl;
        else if (e.user && e.repo) t = `https://github.com/${e.user}/${e.repo}`;
        else throw new Error("You need to specify either the `repoUrl` option or both the `user` and `repo` options");
        let r = new URL(`${t}/issues/new`), n = ["body", "title", "labels", "template", "milestone", "assignee", "projects"];
        for (let i of n) {
          let o = e[i];
          if (o !== void 0) {
            if (i === "labels" || i === "projects") {
              if (!Array.isArray(o)) throw new TypeError(`The \`${i}\` option should be an array`);
              o = o.join(",");
            }
            r.searchParams.set(i, o);
          }
        }
        return r.toString();
      };
      Yr.exports.default = Yr.exports;
    });
    var no = Z((av, Za) => {
      "use strict";
      Za.exports = /* @__PURE__ */ function() {
        function e(t, r, n, i, o) {
          return t < r || n < r ? t > n ? n + 1 : t + 1 : i === o ? r : r + 1;
        }
        return function(t, r) {
          if (t === r) return 0;
          if (t.length > r.length) {
            var n = t;
            t = r, r = n;
          }
          for (var i = t.length, o = r.length; i > 0 && t.charCodeAt(i - 1) === r.charCodeAt(o - 1); ) i--, o--;
          for (var s = 0; s < i && t.charCodeAt(s) === r.charCodeAt(s); ) s++;
          if (i -= s, o -= s, i === 0 || o < 3) return o;
          var a = 0, l, u, c, p, d, f, g, h, O, T, S, C, E = [];
          for (l = 0; l < i; l++) E.push(l + 1), E.push(t.charCodeAt(s + l));
          for (var me = E.length - 1; a < o - 3; ) for (O = r.charCodeAt(s + (u = a)), T = r.charCodeAt(s + (c = a + 1)), S = r.charCodeAt(s + (p = a + 2)), C = r.charCodeAt(s + (d = a + 3)), f = a += 4, l = 0; l < me; l += 2) g = E[l], h = E[l + 1], u = e(g, u, c, O, h), c = e(u, c, p, T, h), p = e(c, p, d, S, h), f = e(p, d, f, C, h), E[l] = f, d = p, p = c, c = u, u = g;
          for (; a < o; ) for (O = r.charCodeAt(s + (u = a)), f = ++a, l = 0; l < me; l += 2) g = E[l], E[l] = f = e(g, u, f, O, E[l + 1]), u = g;
          return f;
        };
      }();
    });
    var Dm = {};
    Vt(Dm, { Debug: () => Un, Decimal: () => Re, Extensions: () => qn, MetricsClient: () => bt, NotFoundError: () => Le, PrismaClientInitializationError: () => R, PrismaClientKnownRequestError: () => V, PrismaClientRustPanicError: () => le, PrismaClientUnknownRequestError: () => B, PrismaClientValidationError: () => J, Public: () => jn, Sql: () => ie, defineDmmfProperty: () => gs, empty: () => Es, getPrismaClient: () => Wl, getRuntime: () => Tn, join: () => bs, makeStrictEnum: () => Hl, makeTypedQueryFactory: () => ys, objectEnumValues: () => en, raw: () => Si, skip: () => tn, sqltag: () => Ai, warnEnvConflicts: () => Kl, warnOnce: () => Xt });
    module.exports = tu(Dm);
    var qn = {};
    Vt(qn, { defineExtension: () => fo, getExtensionContext: () => go });
    function fo(e) {
      return typeof e == "function" ? e : (t) => t.$extends(e);
    }
    function go(e) {
      return e;
    }
    var jn = {};
    Vt(jn, { validator: () => ho });
    function ho(...e) {
      return (t) => t;
    }
    var Nr = {};
    Vt(Nr, { $: () => xo, bgBlack: () => pu, bgBlue: () => gu, bgCyan: () => yu, bgGreen: () => mu, bgMagenta: () => hu, bgRed: () => du, bgWhite: () => bu, bgYellow: () => fu, black: () => au, blue: () => rt, bold: () => H, cyan: () => De, dim: () => Oe, gray: () => Bt, green: () => qe, grey: () => cu, hidden: () => ou, inverse: () => iu, italic: () => nu, magenta: () => lu, red: () => ce, reset: () => ru, strikethrough: () => su, underline: () => X, white: () => uu, yellow: () => ke });
    var Vn;
    var yo;
    var bo;
    var Eo;
    var wo = true;
    typeof process < "u" && ({ FORCE_COLOR: Vn, NODE_DISABLE_COLORS: yo, NO_COLOR: bo, TERM: Eo } = process.env || {}, wo = process.stdout && process.stdout.isTTY);
    var xo = { enabled: !yo && bo == null && Eo !== "dumb" && (Vn != null && Vn !== "0" || wo) };
    function M(e, t) {
      let r = new RegExp(`\\x1b\\[${t}m`, "g"), n = `\x1B[${e}m`, i = `\x1B[${t}m`;
      return function(o) {
        return !xo.enabled || o == null ? o : n + (~("" + o).indexOf(i) ? o.replace(r, i + n) : o) + i;
      };
    }
    var ru = M(0, 0);
    var H = M(1, 22);
    var Oe = M(2, 22);
    var nu = M(3, 23);
    var X = M(4, 24);
    var iu = M(7, 27);
    var ou = M(8, 28);
    var su = M(9, 29);
    var au = M(30, 39);
    var ce = M(31, 39);
    var qe = M(32, 39);
    var ke = M(33, 39);
    var rt = M(34, 39);
    var lu = M(35, 39);
    var De = M(36, 39);
    var uu = M(37, 39);
    var Bt = M(90, 39);
    var cu = M(90, 39);
    var pu = M(40, 49);
    var du = M(41, 49);
    var mu = M(42, 49);
    var fu = M(43, 49);
    var gu = M(44, 49);
    var hu = M(45, 49);
    var yu = M(46, 49);
    var bu = M(47, 49);
    var Eu = 100;
    var Po = ["green", "yellow", "blue", "magenta", "cyan", "red"];
    var Ut = [];
    var vo = Date.now();
    var wu = 0;
    var Bn = typeof process < "u" ? process.env : {};
    var _a2, _b;
    (_b = globalThis.DEBUG) != null ? _b : globalThis.DEBUG = (_a2 = Bn.DEBUG) != null ? _a2 : "";
    var _a3;
    (_a3 = globalThis.DEBUG_COLORS) != null ? _a3 : globalThis.DEBUG_COLORS = Bn.DEBUG_COLORS ? Bn.DEBUG_COLORS === "true" : true;
    var Gt = { enable(e) {
      typeof e == "string" && (globalThis.DEBUG = e);
    }, disable() {
      let e = globalThis.DEBUG;
      return globalThis.DEBUG = "", e;
    }, enabled(e) {
      let t = globalThis.DEBUG.split(",").map((i) => i.replace(/[.+?^${}()|[\]\\]/g, "\\$&")), r = t.some((i) => i === "" || i[0] === "-" ? false : e.match(RegExp(i.split("*").join(".*") + "$"))), n = t.some((i) => i === "" || i[0] !== "-" ? false : e.match(RegExp(i.slice(1).split("*").join(".*") + "$")));
      return r && !n;
    }, log: (...e) => {
      var _a7;
      let [t, r, ...n] = e;
      ((_a7 = console.warn) != null ? _a7 : console.log)(`${t} ${r}`, ...n);
    }, formatters: {} };
    function xu(e) {
      let t = { color: Po[wu++ % Po.length], enabled: Gt.enabled(e), namespace: e, log: Gt.log, extend: () => {
      } }, r = (...n) => {
        let { enabled: i, namespace: o, color: s, log: a } = t;
        if (n.length !== 0 && Ut.push([o, ...n]), Ut.length > Eu && Ut.shift(), Gt.enabled(o) || i) {
          let l = n.map((c) => typeof c == "string" ? c : Pu(c)), u = `+${Date.now() - vo}ms`;
          vo = Date.now(), globalThis.DEBUG_COLORS ? a(Nr[s](H(o)), ...l, Nr[s](u)) : a(o, ...l, u);
        }
      };
      return new Proxy(r, { get: (n, i) => t[i], set: (n, i, o) => t[i] = o });
    }
    var Un = new Proxy(xu, { get: (e, t) => Gt[t], set: (e, t, r) => Gt[t] = r });
    function Pu(e, t = 2) {
      let r = /* @__PURE__ */ new Set();
      return JSON.stringify(e, (n, i) => {
        if (typeof i == "object" && i !== null) {
          if (r.has(i)) return "[Circular *]";
          r.add(i);
        } else if (typeof i == "bigint") return i.toString();
        return i;
      }, t);
    }
    function To(e = 7500) {
      let t = Ut.map(([r, ...n]) => `${r} ${n.map((i) => typeof i == "string" ? i : JSON.stringify(i)).join(" ")}`).join(`
`);
      return t.length < e ? t : t.slice(-e);
    }
    function Ro() {
      Ut.length = 0;
    }
    var L = Un;
    var Co = k(require("fs"));
    function Gn() {
      let e = process.env.PRISMA_QUERY_ENGINE_LIBRARY;
      if (!(e && Co.default.existsSync(e)) && process.arch === "ia32") throw new Error('The default query engine type (Node-API, "library") is currently not supported for 32bit Node. Please set `engineType = "binary"` in the "generator" block of your "schema.prisma" file (or use the environment variables "PRISMA_CLIENT_ENGINE_TYPE=binary" and/or "PRISMA_CLI_QUERY_ENGINE_TYPE=binary".)');
    }
    var Qn = ["darwin", "darwin-arm64", "debian-openssl-1.0.x", "debian-openssl-1.1.x", "debian-openssl-3.0.x", "rhel-openssl-1.0.x", "rhel-openssl-1.1.x", "rhel-openssl-3.0.x", "linux-arm64-openssl-1.1.x", "linux-arm64-openssl-1.0.x", "linux-arm64-openssl-3.0.x", "linux-arm-openssl-1.1.x", "linux-arm-openssl-1.0.x", "linux-arm-openssl-3.0.x", "linux-musl", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-1.1.x", "linux-musl-arm64-openssl-3.0.x", "linux-nixos", "linux-static-x64", "linux-static-arm64", "windows", "freebsd11", "freebsd12", "freebsd13", "freebsd14", "freebsd15", "openbsd", "netbsd", "arm"];
    var Mr = "libquery_engine";
    function $r(e, t) {
      let r = t === "url";
      return e.includes("windows") ? r ? "query_engine.dll.node" : `query_engine-${e}.dll.node` : e.includes("darwin") ? r ? `${Mr}.dylib.node` : `${Mr}-${e}.dylib.node` : r ? `${Mr}.so.node` : `${Mr}-${e}.so.node`;
    }
    var Oo = k(require("child_process"));
    var Kn = k(require("fs/promises"));
    var Ur = k(require("os"));
    var _e = Symbol.for("@ts-pattern/matcher");
    var vu = Symbol.for("@ts-pattern/isVariadic");
    var jr = "@ts-pattern/anonymous-select-key";
    var Jn = (e) => !!(e && typeof e == "object");
    var qr = (e) => e && !!e[_e];
    var Ee = (e, t, r) => {
      if (qr(e)) {
        let n = e[_e](), { matched: i, selections: o } = n.match(t);
        return i && o && Object.keys(o).forEach((s) => r(s, o[s])), i;
      }
      if (Jn(e)) {
        if (!Jn(t)) return false;
        if (Array.isArray(e)) {
          if (!Array.isArray(t)) return false;
          let n = [], i = [], o = [];
          for (let s of e.keys()) {
            let a = e[s];
            qr(a) && a[vu] ? o.push(a) : o.length ? i.push(a) : n.push(a);
          }
          if (o.length) {
            if (o.length > 1) throw new Error("Pattern error: Using `...P.array(...)` several times in a single pattern is not allowed.");
            if (t.length < n.length + i.length) return false;
            let s = t.slice(0, n.length), a = i.length === 0 ? [] : t.slice(-i.length), l = t.slice(n.length, i.length === 0 ? 1 / 0 : -i.length);
            return n.every((u, c) => Ee(u, s[c], r)) && i.every((u, c) => Ee(u, a[c], r)) && (o.length === 0 || Ee(o[0], l, r));
          }
          return e.length === t.length && e.every((s, a) => Ee(s, t[a], r));
        }
        return Object.keys(e).every((n) => {
          let i = e[n];
          return (n in t || qr(o = i) && o[_e]().matcherType === "optional") && Ee(i, t[n], r);
          var o;
        });
      }
      return Object.is(t, e);
    };
    var Ge = (e) => {
      var t, r, n;
      return Jn(e) ? qr(e) ? (t = (r = (n = e[_e]()).getSelectionKeys) == null ? void 0 : r.call(n)) != null ? t : [] : Array.isArray(e) ? Qt(e, Ge) : Qt(Object.values(e), Ge) : [];
    };
    var Qt = (e, t) => e.reduce((r, n) => r.concat(t(n)), []);
    function pe(e) {
      return Object.assign(e, { optional: () => Tu(e), and: (t) => j(e, t), or: (t) => Ru(e, t), select: (t) => t === void 0 ? So(e) : So(t, e) });
    }
    function Tu(e) {
      return pe({ [_e]: () => ({ match: (t) => {
        let r = {}, n = (i, o) => {
          r[i] = o;
        };
        return t === void 0 ? (Ge(e).forEach((i) => n(i, void 0)), { matched: true, selections: r }) : { matched: Ee(e, t, n), selections: r };
      }, getSelectionKeys: () => Ge(e), matcherType: "optional" }) });
    }
    function j(...e) {
      return pe({ [_e]: () => ({ match: (t) => {
        let r = {}, n = (i, o) => {
          r[i] = o;
        };
        return { matched: e.every((i) => Ee(i, t, n)), selections: r };
      }, getSelectionKeys: () => Qt(e, Ge), matcherType: "and" }) });
    }
    function Ru(...e) {
      return pe({ [_e]: () => ({ match: (t) => {
        let r = {}, n = (i, o) => {
          r[i] = o;
        };
        return Qt(e, Ge).forEach((i) => n(i, void 0)), { matched: e.some((i) => Ee(i, t, n)), selections: r };
      }, getSelectionKeys: () => Qt(e, Ge), matcherType: "or" }) });
    }
    function I(e) {
      return { [_e]: () => ({ match: (t) => ({ matched: !!e(t) }) }) };
    }
    function So(...e) {
      let t = typeof e[0] == "string" ? e[0] : void 0, r = e.length === 2 ? e[1] : typeof e[0] == "string" ? void 0 : e[0];
      return pe({ [_e]: () => ({ match: (n) => {
        let i = { [t != null ? t : jr]: n };
        return { matched: r === void 0 || Ee(r, n, (o, s) => {
          i[o] = s;
        }), selections: i };
      }, getSelectionKeys: () => [t != null ? t : jr].concat(r === void 0 ? [] : Ge(r)) }) });
    }
    function ye(e) {
      return typeof e == "number";
    }
    function je(e) {
      return typeof e == "string";
    }
    function Ve(e) {
      return typeof e == "bigint";
    }
    var Qm = pe(I(function(e) {
      return true;
    }));
    var Be = (e) => Object.assign(pe(e), { startsWith: (t) => {
      return Be(j(e, (r = t, I((n) => je(n) && n.startsWith(r)))));
      var r;
    }, endsWith: (t) => {
      return Be(j(e, (r = t, I((n) => je(n) && n.endsWith(r)))));
      var r;
    }, minLength: (t) => Be(j(e, ((r) => I((n) => je(n) && n.length >= r))(t))), length: (t) => Be(j(e, ((r) => I((n) => je(n) && n.length === r))(t))), maxLength: (t) => Be(j(e, ((r) => I((n) => je(n) && n.length <= r))(t))), includes: (t) => {
      return Be(j(e, (r = t, I((n) => je(n) && n.includes(r)))));
      var r;
    }, regex: (t) => {
      return Be(j(e, (r = t, I((n) => je(n) && !!n.match(r)))));
      var r;
    } });
    var Jm = Be(I(je));
    var be = (e) => Object.assign(pe(e), { between: (t, r) => be(j(e, ((n, i) => I((o) => ye(o) && n <= o && i >= o))(t, r))), lt: (t) => be(j(e, ((r) => I((n) => ye(n) && n < r))(t))), gt: (t) => be(j(e, ((r) => I((n) => ye(n) && n > r))(t))), lte: (t) => be(j(e, ((r) => I((n) => ye(n) && n <= r))(t))), gte: (t) => be(j(e, ((r) => I((n) => ye(n) && n >= r))(t))), int: () => be(j(e, I((t) => ye(t) && Number.isInteger(t)))), finite: () => be(j(e, I((t) => ye(t) && Number.isFinite(t)))), positive: () => be(j(e, I((t) => ye(t) && t > 0))), negative: () => be(j(e, I((t) => ye(t) && t < 0))) });
    var Wm = be(I(ye));
    var Ue = (e) => Object.assign(pe(e), { between: (t, r) => Ue(j(e, ((n, i) => I((o) => Ve(o) && n <= o && i >= o))(t, r))), lt: (t) => Ue(j(e, ((r) => I((n) => Ve(n) && n < r))(t))), gt: (t) => Ue(j(e, ((r) => I((n) => Ve(n) && n > r))(t))), lte: (t) => Ue(j(e, ((r) => I((n) => Ve(n) && n <= r))(t))), gte: (t) => Ue(j(e, ((r) => I((n) => Ve(n) && n >= r))(t))), positive: () => Ue(j(e, I((t) => Ve(t) && t > 0))), negative: () => Ue(j(e, I((t) => Ve(t) && t < 0))) });
    var Hm = Ue(I(Ve));
    var Km = pe(I(function(e) {
      return typeof e == "boolean";
    }));
    var zm = pe(I(function(e) {
      return typeof e == "symbol";
    }));
    var Ym = pe(I(function(e) {
      return e == null;
    }));
    var Zm = pe(I(function(e) {
      return e != null;
    }));
    var Wn = { matched: false, value: void 0 };
    function mt(e) {
      return new Hn(e, Wn);
    }
    var Hn = class e {
      constructor(t, r) {
        this.input = void 0, this.state = void 0, this.input = t, this.state = r;
      }
      with(...t) {
        if (this.state.matched) return this;
        let r = t[t.length - 1], n = [t[0]], i;
        t.length === 3 && typeof t[1] == "function" ? i = t[1] : t.length > 2 && n.push(...t.slice(1, t.length - 1));
        let o = false, s = {}, a = (u, c) => {
          o = true, s[u] = c;
        }, l = !n.some((u) => Ee(u, this.input, a)) || i && !i(this.input) ? Wn : { matched: true, value: r(o ? jr in s ? s[jr] : s : this.input, this.input) };
        return new e(this.input, l);
      }
      when(t, r) {
        if (this.state.matched) return this;
        let n = !!t(this.input);
        return new e(this.input, n ? { matched: true, value: r(this.input, this.input) } : Wn);
      }
      otherwise(t) {
        return this.state.matched ? this.state.value : t(this.input);
      }
      exhaustive() {
        if (this.state.matched) return this.state.value;
        let t;
        try {
          t = JSON.stringify(this.input);
        } catch (e2) {
          t = this.input;
        }
        throw new Error(`Pattern matching error: no pattern matches value ${t}`);
      }
      run() {
        return this.exhaustive();
      }
      returnType() {
        return this;
      }
    };
    var ko = require("util");
    var Cu = { warn: ke("prisma:warn") };
    var Su = { warn: () => !process.env.PRISMA_DISABLE_WARNINGS };
    function Vr(e, ...t) {
      Su.warn() && console.warn(`${Cu.warn} ${e}`, ...t);
    }
    var Au = (0, ko.promisify)(Oo.default.exec);
    var te = L("prisma:get-platform");
    var Iu = ["1.0.x", "1.1.x", "3.0.x"];
    function Do() {
      return __async(this, null, function* () {
        let e = Ur.default.platform(), t = process.arch;
        if (e === "freebsd") {
          let s = yield Gr("freebsd-version");
          if (s && s.trim().length > 0) {
            let l = /^(\d+)\.?/.exec(s);
            if (l) return { platform: "freebsd", targetDistro: `freebsd${l[1]}`, arch: t };
          }
        }
        if (e !== "linux") return { platform: e, arch: t };
        let r = yield ku(), n = yield qu(), i = _u({ arch: t, archFromUname: n, familyDistro: r.familyDistro }), { libssl: o } = yield Fu(i);
        return __spreadValues({ platform: "linux", libssl: o, arch: t, archFromUname: n }, r);
      });
    }
    function Ou(e) {
      let t = /^ID="?([^"\n]*)"?$/im, r = /^ID_LIKE="?([^"\n]*)"?$/im, n = t.exec(e), i = n && n[1] && n[1].toLowerCase() || "", o = r.exec(e), s = o && o[1] && o[1].toLowerCase() || "", a = mt({ id: i, idLike: s }).with({ id: "alpine" }, ({ id: l }) => ({ targetDistro: "musl", familyDistro: l, originalDistro: l })).with({ id: "raspbian" }, ({ id: l }) => ({ targetDistro: "arm", familyDistro: "debian", originalDistro: l })).with({ id: "nixos" }, ({ id: l }) => ({ targetDistro: "nixos", originalDistro: l, familyDistro: "nixos" })).with({ id: "debian" }, { id: "ubuntu" }, ({ id: l }) => ({ targetDistro: "debian", familyDistro: "debian", originalDistro: l })).with({ id: "rhel" }, { id: "centos" }, { id: "fedora" }, ({ id: l }) => ({ targetDistro: "rhel", familyDistro: "rhel", originalDistro: l })).when(({ idLike: l }) => l.includes("debian") || l.includes("ubuntu"), ({ id: l }) => ({ targetDistro: "debian", familyDistro: "debian", originalDistro: l })).when(({ idLike: l }) => i === "arch" || l.includes("arch"), ({ id: l }) => ({ targetDistro: "debian", familyDistro: "arch", originalDistro: l })).when(({ idLike: l }) => l.includes("centos") || l.includes("fedora") || l.includes("rhel") || l.includes("suse"), ({ id: l }) => ({ targetDistro: "rhel", familyDistro: "rhel", originalDistro: l })).otherwise(({ id: l }) => ({ targetDistro: void 0, familyDistro: void 0, originalDistro: l }));
      return te(`Found distro info:
${JSON.stringify(a, null, 2)}`), a;
    }
    function ku() {
      return __async(this, null, function* () {
        let e = "/etc/os-release";
        try {
          let t = yield Kn.default.readFile(e, { encoding: "utf-8" });
          return Ou(t);
        } catch (e2) {
          return { targetDistro: void 0, familyDistro: void 0, originalDistro: void 0 };
        }
      });
    }
    function Du(e) {
      let t = /^OpenSSL\s(\d+\.\d+)\.\d+/.exec(e);
      if (t) {
        let r = `${t[1]}.x`;
        return _o(r);
      }
    }
    function Ao(e) {
      var _a7;
      let t = /libssl\.so\.(\d)(\.\d)?/.exec(e);
      if (t) {
        let r = `${t[1]}${(_a7 = t[2]) != null ? _a7 : ".0"}.x`;
        return _o(r);
      }
    }
    function _o(e) {
      let t = (() => {
        if (Lo(e)) return e;
        let r = e.split(".");
        return r[1] = "0", r.join(".");
      })();
      if (Iu.includes(t)) return t;
    }
    function _u(e) {
      return mt(e).with({ familyDistro: "musl" }, () => (te('Trying platform-specific paths for "alpine"'), ["/lib"])).with({ familyDistro: "debian" }, ({ archFromUname: t }) => (te('Trying platform-specific paths for "debian" (and "ubuntu")'), [`/usr/lib/${t}-linux-gnu`, `/lib/${t}-linux-gnu`])).with({ familyDistro: "rhel" }, () => (te('Trying platform-specific paths for "rhel"'), ["/lib64", "/usr/lib64"])).otherwise(({ familyDistro: t, arch: r, archFromUname: n }) => (te(`Don't know any platform-specific paths for "${t}" on ${r} (${n})`), []));
    }
    function Fu(e) {
      return __async(this, null, function* () {
        let t = 'grep -v "libssl.so.0"', r = yield Io(e);
        if (r) {
          te(`Found libssl.so file using platform-specific paths: ${r}`);
          let o = Ao(r);
          if (te(`The parsed libssl version is: ${o}`), o) return { libssl: o, strategy: "libssl-specific-path" };
        }
        te('Falling back to "ldconfig" and other generic paths');
        let n = yield Gr(`ldconfig -p | sed "s/.*=>s*//" | sed "s|.*/||" | grep libssl | sort | ${t}`);
        if (n || (n = yield Io(["/lib64", "/usr/lib64", "/lib"])), n) {
          te(`Found libssl.so file using "ldconfig" or other generic paths: ${n}`);
          let o = Ao(n);
          if (te(`The parsed libssl version is: ${o}`), o) return { libssl: o, strategy: "ldconfig" };
        }
        let i = yield Gr("openssl version -v");
        if (i) {
          te(`Found openssl binary with version: ${i}`);
          let o = Du(i);
          if (te(`The parsed openssl version is: ${o}`), o) return { libssl: o, strategy: "openssl-binary" };
        }
        return te("Couldn't find any version of libssl or OpenSSL in the system"), {};
      });
    }
    function Io(e) {
      return __async(this, null, function* () {
        for (let t of e) {
          let r = yield Lu(t);
          if (r) return r;
        }
      });
    }
    function Lu(e) {
      return __async(this, null, function* () {
        try {
          return (yield Kn.default.readdir(e)).find((r) => r.startsWith("libssl.so.") && !r.startsWith("libssl.so.0"));
        } catch (t) {
          if (t.code === "ENOENT") return;
          throw t;
        }
      });
    }
    function nt() {
      return __async(this, null, function* () {
        let { binaryTarget: e } = yield Fo();
        return e;
      });
    }
    function Nu(e) {
      return e.binaryTarget !== void 0;
    }
    function zn() {
      return __async(this, null, function* () {
        let _a7 = yield Fo(), { memoized: e } = _a7, t = __objRest(_a7, ["memoized"]);
        return t;
      });
    }
    var Br = {};
    function Fo() {
      return __async(this, null, function* () {
        if (Nu(Br)) return Promise.resolve(__spreadProps(__spreadValues({}, Br), { memoized: true }));
        let e = yield Do(), t = Mu(e);
        return Br = __spreadProps(__spreadValues({}, e), { binaryTarget: t }), __spreadProps(__spreadValues({}, Br), { memoized: false });
      });
    }
    function Mu(e) {
      let { platform: t, arch: r, archFromUname: n, libssl: i, targetDistro: o, familyDistro: s, originalDistro: a } = e;
      t === "linux" && !["x64", "arm64"].includes(r) && Vr(`Prisma only officially supports Linux on amd64 (x86_64) and arm64 (aarch64) system architectures (detected "${r}" instead). If you are using your own custom Prisma engines, you can ignore this warning, as long as you've compiled the engines for your system architecture "${n}".`);
      let l = "1.1.x";
      if (t === "linux" && i === void 0) {
        let c = mt({ familyDistro: s }).with({ familyDistro: "debian" }, () => "Please manually install OpenSSL via `apt-get update -y && apt-get install -y openssl` and try installing Prisma again. If you're running Prisma on Docker, add this command to your Dockerfile, or switch to an image that already has OpenSSL installed.").otherwise(() => "Please manually install OpenSSL and try installing Prisma again.");
        Vr(`Prisma failed to detect the libssl/openssl version to use, and may not work as expected. Defaulting to "openssl-${l}".
${c}`);
      }
      let u = "debian";
      if (t === "linux" && o === void 0 && te(`Distro is "${a}". Falling back to Prisma engines built for "${u}".`), t === "darwin" && r === "arm64") return "darwin-arm64";
      if (t === "darwin") return "darwin";
      if (t === "win32") return "windows";
      if (t === "freebsd") return o;
      if (t === "openbsd") return "openbsd";
      if (t === "netbsd") return "netbsd";
      if (t === "linux" && o === "nixos") return "linux-nixos";
      if (t === "linux" && r === "arm64") return `${o === "musl" ? "linux-musl-arm64" : "linux-arm64"}-openssl-${i || l}`;
      if (t === "linux" && r === "arm") return `linux-arm-openssl-${i || l}`;
      if (t === "linux" && o === "musl") {
        let c = "linux-musl";
        return !i || Lo(i) ? c : `${c}-openssl-${i}`;
      }
      return t === "linux" && o && i ? `${o}-openssl-${i}` : (t !== "linux" && Vr(`Prisma detected unknown OS "${t}" and may not work as expected. Defaulting to "linux".`), i ? `${u}-openssl-${i}` : o ? `${o}-openssl-${l}` : `${u}-openssl-${l}`);
    }
    function $u(e) {
      return __async(this, null, function* () {
        try {
          return yield e();
        } catch (e2) {
          return;
        }
      });
    }
    function Gr(e) {
      return $u(() => __async(this, null, function* () {
        let t = yield Au(e);
        return te(`Command "${e}" successfully returned "${t.stdout}"`), t.stdout;
      }));
    }
    function qu() {
      return __async(this, null, function* () {
        var _a7;
        return typeof Ur.default.machine == "function" ? Ur.default.machine() : (_a7 = yield Gr("uname -m")) == null ? void 0 : _a7.trim();
      });
    }
    function Lo(e) {
      return e.startsWith("1.");
    }
    var Wo = k(Jo());
    function ni(e) {
      return (0, Wo.default)(e, e, { fallback: X });
    }
    var Qu = k(oi());
    var $ = k(require("path"));
    var Ju = k(oi());
    var kf = L("prisma:engines");
    function Ho() {
      return $.default.join(__dirname, "../");
    }
    var Df = "libquery-engine";
    $.default.join(__dirname, "../query-engine-darwin");
    $.default.join(__dirname, "../query-engine-darwin-arm64");
    $.default.join(__dirname, "../query-engine-debian-openssl-1.0.x");
    $.default.join(__dirname, "../query-engine-debian-openssl-1.1.x");
    $.default.join(__dirname, "../query-engine-debian-openssl-3.0.x");
    $.default.join(__dirname, "../query-engine-linux-static-x64");
    $.default.join(__dirname, "../query-engine-linux-static-arm64");
    $.default.join(__dirname, "../query-engine-rhel-openssl-1.0.x");
    $.default.join(__dirname, "../query-engine-rhel-openssl-1.1.x");
    $.default.join(__dirname, "../query-engine-rhel-openssl-3.0.x");
    $.default.join(__dirname, "../libquery_engine-darwin.dylib.node");
    $.default.join(__dirname, "../libquery_engine-darwin-arm64.dylib.node");
    $.default.join(__dirname, "../libquery_engine-debian-openssl-1.0.x.so.node");
    $.default.join(__dirname, "../libquery_engine-debian-openssl-1.1.x.so.node");
    $.default.join(__dirname, "../libquery_engine-debian-openssl-3.0.x.so.node");
    $.default.join(__dirname, "../libquery_engine-linux-arm64-openssl-1.0.x.so.node");
    $.default.join(__dirname, "../libquery_engine-linux-arm64-openssl-1.1.x.so.node");
    $.default.join(__dirname, "../libquery_engine-linux-arm64-openssl-3.0.x.so.node");
    $.default.join(__dirname, "../libquery_engine-linux-musl.so.node");
    $.default.join(__dirname, "../libquery_engine-linux-musl-openssl-3.0.x.so.node");
    $.default.join(__dirname, "../libquery_engine-rhel-openssl-1.0.x.so.node");
    $.default.join(__dirname, "../libquery_engine-rhel-openssl-1.1.x.so.node");
    $.default.join(__dirname, "../libquery_engine-rhel-openssl-3.0.x.so.node");
    $.default.join(__dirname, "../query_engine-windows.dll.node");
    var si = k(require("fs"));
    var Ko = L("chmodPlusX");
    function ai(e) {
      if (process.platform === "win32") return;
      let t = si.default.statSync(e), r = t.mode | 64 | 8 | 1;
      if (t.mode === r) {
        Ko(`Execution permissions of ${e} are fine`);
        return;
      }
      let n = r.toString(8).slice(-3);
      Ko(`Have to call chmodPlusX on ${e}`), si.default.chmodSync(e, n);
    }
    function li(e) {
      let t = e.e, r = (a) => `Prisma cannot find the required \`${a}\` system library in your system`, n = t.message.includes("cannot open shared object file"), i = `Please refer to the documentation about Prisma's system requirements: ${ni("https://pris.ly/d/system-requirements")}`, o = `Unable to require(\`${Oe(e.id)}\`).`, s = mt({ message: t.message, code: t.code }).with({ code: "ENOENT" }, () => "File does not exist.").when(({ message: a }) => n && a.includes("libz"), () => `${r("libz")}. Please install it and try again.`).when(({ message: a }) => n && a.includes("libgcc_s"), () => `${r("libgcc_s")}. Please install it and try again.`).when(({ message: a }) => n && a.includes("libssl"), () => {
        let a = e.platformInfo.libssl ? `openssl-${e.platformInfo.libssl}` : "openssl";
        return `${r("libssl")}. Please install ${a} and try again.`;
      }).when(({ message: a }) => a.includes("GLIBC"), () => `Prisma has detected an incompatible version of the \`glibc\` C standard library installed in your system. This probably means your system may be too old to run Prisma. ${i}`).when(({ message: a }) => e.platformInfo.platform === "linux" && a.includes("symbol not found"), () => `The Prisma engines are not compatible with your system ${e.platformInfo.originalDistro} on (${e.platformInfo.archFromUname}) which uses the \`${e.platformInfo.binaryTarget}\` binaryTarget by default. ${i}`).otherwise(() => `The Prisma engines do not seem to be compatible with your system. ${i}`);
      return `${o}
${s}

Details: ${t.message}`;
    }
    var pi = k(Zo());
    var Kr = k(require("fs"));
    var ht = k(require("path"));
    function Xo(e) {
      let t = e.ignoreProcessEnv ? {} : process.env, r = (n) => {
        var _a7, _b2;
        return (_b2 = (_a7 = n.match(/(.?\${(?:[a-zA-Z0-9_]+)?})/g)) == null ? void 0 : _a7.reduce(function(o, s) {
          let a = /(.?)\${([a-zA-Z0-9_]+)?}/g.exec(s);
          if (!a) return o;
          let l = a[1], u, c;
          if (l === "\\") c = a[0], u = c.replace("\\$", "$");
          else {
            let p = a[2];
            c = a[0].substring(l.length), u = Object.hasOwnProperty.call(t, p) ? t[p] : e.parsed[p] || "", u = r(u);
          }
          return o.replace(c, u);
        }, n)) != null ? _b2 : n;
      };
      for (let n in e.parsed) {
        let i = Object.hasOwnProperty.call(t, n) ? t[n] : e.parsed[n];
        e.parsed[n] = r(i);
      }
      for (let n in e.parsed) t[n] = e.parsed[n];
      return e;
    }
    var ci = L("prisma:tryLoadEnv");
    function Ht({ rootEnvPath: e, schemaEnvPath: t }, r = { conflictCheck: "none" }) {
      var _a7, _b2;
      let n = es(e);
      r.conflictCheck !== "none" && rc(n, t, r.conflictCheck);
      let i = null;
      return ts(n == null ? void 0 : n.path, t) || (i = es(t)), !n && !i && ci("No Environment variables loaded"), (i == null ? void 0 : i.dotenvResult.error) ? console.error(ce(H("Schema Env Error: ")) + i.dotenvResult.error) : { message: [n == null ? void 0 : n.message, i == null ? void 0 : i.message].filter(Boolean).join(`
`), parsed: __spreadValues(__spreadValues({}, (_a7 = n == null ? void 0 : n.dotenvResult) == null ? void 0 : _a7.parsed), (_b2 = i == null ? void 0 : i.dotenvResult) == null ? void 0 : _b2.parsed) };
    }
    function rc(e, t, r) {
      let n = e == null ? void 0 : e.dotenvResult.parsed, i = !ts(e == null ? void 0 : e.path, t);
      if (n && t && i && Kr.default.existsSync(t)) {
        let o = pi.default.parse(Kr.default.readFileSync(t)), s = [];
        for (let a in o) n[a] === o[a] && s.push(a);
        if (s.length > 0) {
          let a = ht.default.relative(process.cwd(), e.path), l = ht.default.relative(process.cwd(), t);
          if (r === "error") {
            let u = `There is a conflict between env var${s.length > 1 ? "s" : ""} in ${X(a)} and ${X(l)}
Conflicting env vars:
${s.map((c) => `  ${H(c)}`).join(`
`)}

We suggest to move the contents of ${X(l)} to ${X(a)} to consolidate your env vars.
`;
            throw new Error(u);
          } else if (r === "warn") {
            let u = `Conflict for env var${s.length > 1 ? "s" : ""} ${s.map((c) => H(c)).join(", ")} in ${X(a)} and ${X(l)}
Env vars from ${X(l)} overwrite the ones from ${X(a)}
      `;
            console.warn(`${ke("warn(prisma)")} ${u}`);
          }
        }
      }
    }
    function es(e) {
      if (nc(e)) {
        ci(`Environment variables loaded from ${e}`);
        let t = pi.default.config({ path: e, debug: process.env.DOTENV_CONFIG_DEBUG ? true : void 0 });
        return { dotenvResult: Xo(t), message: Oe(`Environment variables loaded from ${ht.default.relative(process.cwd(), e)}`), path: e };
      } else ci(`Environment variables not found at ${e}`);
      return null;
    }
    function ts(e, t) {
      return e && t && ht.default.resolve(e) === ht.default.resolve(t);
    }
    function nc(e) {
      return !!(e && Kr.default.existsSync(e));
    }
    var rs = "library";
    function Kt(e) {
      let t = ic();
      return t || ((e == null ? void 0 : e.config.engineType) === "library" ? "library" : (e == null ? void 0 : e.config.engineType) === "binary" ? "binary" : rs);
    }
    function ic() {
      let e = process.env.PRISMA_CLIENT_ENGINE_TYPE;
      return e === "library" ? "library" : e === "binary" ? "binary" : void 0;
    }
    var Je;
    ((t) => {
      let e;
      ((E) => (E.findUnique = "findUnique", E.findUniqueOrThrow = "findUniqueOrThrow", E.findFirst = "findFirst", E.findFirstOrThrow = "findFirstOrThrow", E.findMany = "findMany", E.create = "create", E.createMany = "createMany", E.createManyAndReturn = "createManyAndReturn", E.update = "update", E.updateMany = "updateMany", E.upsert = "upsert", E.delete = "delete", E.deleteMany = "deleteMany", E.groupBy = "groupBy", E.count = "count", E.aggregate = "aggregate", E.findRaw = "findRaw", E.aggregateRaw = "aggregateRaw"))(e = t.ModelAction || (t.ModelAction = {}));
    })(Je || (Je = {}));
    var zt = k(require("path"));
    function di(e) {
      return zt.default.sep === zt.default.posix.sep ? e : e.split(zt.default.sep).join(zt.default.posix.sep);
    }
    var ls = k(mi());
    function gi(e) {
      return String(new fi(e));
    }
    var fi = class {
      constructor(t) {
        this.config = t;
      }
      toString() {
        let { config: t } = this, r = t.provider.fromEnvVar ? `env("${t.provider.fromEnvVar}")` : t.provider.value, n = JSON.parse(JSON.stringify({ provider: r, binaryTargets: sc(t.binaryTargets) }));
        return `generator ${t.name} {
${(0, ls.default)(ac(n), 2)}
}`;
      }
    };
    function sc(e) {
      let t;
      if (e.length > 0) {
        let r = e.find((n) => n.fromEnvVar !== null);
        r ? t = `env("${r.fromEnvVar}")` : t = e.map((n) => n.native ? "native" : n.value);
      } else t = void 0;
      return t;
    }
    function ac(e) {
      let t = Object.keys(e).reduce((r, n) => Math.max(r, n.length), 0);
      return Object.entries(e).map(([r, n]) => `${r.padEnd(t)} = ${lc(n)}`).join(`
`);
    }
    function lc(e) {
      return JSON.parse(JSON.stringify(e, (t, r) => Array.isArray(r) ? `[${r.map((n) => JSON.stringify(n)).join(", ")}]` : JSON.stringify(r)));
    }
    var Zt = {};
    Vt(Zt, { error: () => pc, info: () => cc, log: () => uc, query: () => dc, should: () => us, tags: () => Yt, warn: () => hi });
    var Yt = { error: ce("prisma:error"), warn: ke("prisma:warn"), info: De("prisma:info"), query: rt("prisma:query") };
    var us = { warn: () => !process.env.PRISMA_DISABLE_WARNINGS };
    function uc(...e) {
      console.log(...e);
    }
    function hi(e, ...t) {
      us.warn() && console.warn(`${Yt.warn} ${e}`, ...t);
    }
    function cc(e, ...t) {
      console.info(`${Yt.info} ${e}`, ...t);
    }
    function pc(e, ...t) {
      console.error(`${Yt.error} ${e}`, ...t);
    }
    function dc(e, ...t) {
      console.log(`${Yt.query} ${e}`, ...t);
    }
    function zr(e, t) {
      if (!e) throw new Error(`${t}. This should never happen. If you see this error, please, open an issue at https://pris.ly/prisma-prisma-bug-report`);
    }
    function Fe(e, t) {
      throw new Error(t);
    }
    function bi(e, t) {
      return Object.prototype.hasOwnProperty.call(e, t);
    }
    var Ei = (e, t) => e.reduce((r, n) => (r[t(n)] = n, r), {});
    function yt(e, t) {
      let r = {};
      for (let n of Object.keys(e)) r[n] = t(e[n], n);
      return r;
    }
    function wi(e, t) {
      if (e.length === 0) return;
      let r = e[0];
      for (let n = 1; n < e.length; n++) t(r, e[n]) < 0 && (r = e[n]);
      return r;
    }
    function w(e, t) {
      Object.defineProperty(e, "name", { value: t, configurable: true });
    }
    var fs = /* @__PURE__ */ new Set();
    var Xt = (e, t, ...r) => {
      fs.has(e) || (fs.add(e), hi(t, ...r));
    };
    var V = class extends Error {
      constructor(t, { code: r, clientVersion: n, meta: i, batchRequestIdx: o }) {
        super(t), this.name = "PrismaClientKnownRequestError", this.code = r, this.clientVersion = n, this.meta = i, Object.defineProperty(this, "batchRequestIdx", { value: o, enumerable: false, writable: true });
      }
      get [Symbol.toStringTag]() {
        return "PrismaClientKnownRequestError";
      }
    };
    w(V, "PrismaClientKnownRequestError");
    var Le = class extends V {
      constructor(t, r) {
        super(t, { code: "P2025", clientVersion: r }), this.name = "NotFoundError";
      }
    };
    w(Le, "NotFoundError");
    var R = class e extends Error {
      constructor(t, r, n) {
        super(t), this.name = "PrismaClientInitializationError", this.clientVersion = r, this.errorCode = n, Error.captureStackTrace(e);
      }
      get [Symbol.toStringTag]() {
        return "PrismaClientInitializationError";
      }
    };
    w(R, "PrismaClientInitializationError");
    var le = class extends Error {
      constructor(t, r) {
        super(t), this.name = "PrismaClientRustPanicError", this.clientVersion = r;
      }
      get [Symbol.toStringTag]() {
        return "PrismaClientRustPanicError";
      }
    };
    w(le, "PrismaClientRustPanicError");
    var B = class extends Error {
      constructor(t, { clientVersion: r, batchRequestIdx: n }) {
        super(t), this.name = "PrismaClientUnknownRequestError", this.clientVersion = r, Object.defineProperty(this, "batchRequestIdx", { value: n, writable: true, enumerable: false });
      }
      get [Symbol.toStringTag]() {
        return "PrismaClientUnknownRequestError";
      }
    };
    w(B, "PrismaClientUnknownRequestError");
    var J = class extends Error {
      constructor(r, { clientVersion: n }) {
        super(r);
        this.name = "PrismaClientValidationError";
        this.clientVersion = n;
      }
      get [Symbol.toStringTag]() {
        return "PrismaClientValidationError";
      }
    };
    w(J, "PrismaClientValidationError");
    var bt = class {
      constructor(t) {
        this._engine = t;
      }
      prometheus(t) {
        return this._engine.metrics(__spreadValues({ format: "prometheus" }, t));
      }
      json(t) {
        return this._engine.metrics(__spreadValues({ format: "json" }, t));
      }
    };
    function er(e) {
      let t;
      return { get() {
        return t || (t = { value: e() }), t.value;
      } };
    }
    function gs(e, t) {
      let r = er(() => fc(t));
      Object.defineProperty(e, "dmmf", { get: () => r.get() });
    }
    function fc(e) {
      return { datamodel: { models: xi(e.models), enums: xi(e.enums), types: xi(e.types) } };
    }
    function xi(e) {
      return Object.entries(e).map(([t, r]) => __spreadValues({ name: t }, r));
    }
    var Xr = Symbol();
    var Pi = /* @__PURE__ */ new WeakMap();
    var Ne = class {
      constructor(t) {
        t === Xr ? Pi.set(this, `Prisma.${this._getName()}`) : Pi.set(this, `new Prisma.${this._getNamespace()}.${this._getName()}()`);
      }
      _getName() {
        return this.constructor.name;
      }
      toString() {
        return Pi.get(this);
      }
    };
    var tr = class extends Ne {
      _getNamespace() {
        return "NullTypes";
      }
    };
    var rr = class extends tr {
    };
    vi(rr, "DbNull");
    var nr = class extends tr {
    };
    vi(nr, "JsonNull");
    var ir = class extends tr {
    };
    vi(ir, "AnyNull");
    var en = { classes: { DbNull: rr, JsonNull: nr, AnyNull: ir }, instances: { DbNull: new rr(Xr), JsonNull: new nr(Xr), AnyNull: new ir(Xr) } };
    function vi(e, t) {
      Object.defineProperty(e, "name", { value: t, configurable: true });
    }
    var hs = Symbol();
    var or = class {
      constructor(t) {
        if (t !== hs) throw new Error("Skip instance can not be constructed directly");
      }
      ifUndefined(t) {
        return t === void 0 ? tn : t;
      }
    };
    var tn = new or(hs);
    function we(e) {
      return e instanceof or;
    }
    var Ti = /* @__PURE__ */ new WeakMap();
    var sr = class {
      constructor(t, r) {
        Ti.set(this, { sql: t, values: r });
      }
      get sql() {
        return Ti.get(this).sql;
      }
      get values() {
        return Ti.get(this).values;
      }
    };
    function ys(e) {
      return (...t) => new sr(e, t);
    }
    function ar(e) {
      return { ok: false, error: e, map() {
        return ar(e);
      }, flatMap() {
        return ar(e);
      } };
    }
    var Ri = class {
      constructor() {
        this.registeredErrors = [];
      }
      consumeError(t) {
        return this.registeredErrors[t];
      }
      registerNewError(t) {
        let r = 0;
        for (; this.registeredErrors[r] !== void 0; ) r++;
        return this.registeredErrors[r] = { error: t }, r;
      }
    };
    var Ci = (e) => {
      let t = new Ri(), r = xe(t, e.transactionContext.bind(e)), n = { adapterName: e.adapterName, errorRegistry: t, queryRaw: xe(t, e.queryRaw.bind(e)), executeRaw: xe(t, e.executeRaw.bind(e)), provider: e.provider, transactionContext: (...i) => __async(exports, null, function* () {
        return (yield r(...i)).map((s) => gc(t, s));
      }) };
      return e.getConnectionInfo && (n.getConnectionInfo = yc(t, e.getConnectionInfo.bind(e))), n;
    };
    var gc = (e, t) => {
      let r = xe(e, t.startTransaction.bind(t));
      return { adapterName: t.adapterName, provider: t.provider, queryRaw: xe(e, t.queryRaw.bind(t)), executeRaw: xe(e, t.executeRaw.bind(t)), startTransaction: (...n) => __async(exports, null, function* () {
        return (yield r(...n)).map((o) => hc(e, o));
      }) };
    };
    var hc = (e, t) => ({ adapterName: t.adapterName, provider: t.provider, options: t.options, queryRaw: xe(e, t.queryRaw.bind(t)), executeRaw: xe(e, t.executeRaw.bind(t)), commit: xe(e, t.commit.bind(t)), rollback: xe(e, t.rollback.bind(t)) });
    function xe(e, t) {
      return (...r) => __async(this, null, function* () {
        try {
          return yield t(...r);
        } catch (n) {
          let i = e.registerNewError(n);
          return ar({ kind: "GenericJs", id: i });
        }
      });
    }
    function yc(e, t) {
      return (...r) => {
        try {
          return t(...r);
        } catch (n) {
          let i = e.registerNewError(n);
          return ar({ kind: "GenericJs", id: i });
        }
      };
    }
    var Ul = k(ii());
    var Gl = require("async_hooks");
    var Ql = require("events");
    var Jl = k(require("fs"));
    var _r = k(require("path"));
    var ie = class e {
      constructor(t, r) {
        if (t.length - 1 !== r.length) throw t.length === 0 ? new TypeError("Expected at least 1 string") : new TypeError(`Expected ${t.length} strings to have ${t.length - 1} values`);
        let n = r.reduce((s, a) => s + (a instanceof e ? a.values.length : 1), 0);
        this.values = new Array(n), this.strings = new Array(n + 1), this.strings[0] = t[0];
        let i = 0, o = 0;
        for (; i < r.length; ) {
          let s = r[i++], a = t[i];
          if (s instanceof e) {
            this.strings[o] += s.strings[0];
            let l = 0;
            for (; l < s.values.length; ) this.values[o++] = s.values[l++], this.strings[o] = s.strings[l];
            this.strings[o] += a;
          } else this.values[o++] = s, this.strings[o] = a;
        }
      }
      get sql() {
        let t = this.strings.length, r = 1, n = this.strings[0];
        for (; r < t; ) n += `?${this.strings[r++]}`;
        return n;
      }
      get statement() {
        let t = this.strings.length, r = 1, n = this.strings[0];
        for (; r < t; ) n += `:${r}${this.strings[r++]}`;
        return n;
      }
      get text() {
        let t = this.strings.length, r = 1, n = this.strings[0];
        for (; r < t; ) n += `$${r}${this.strings[r++]}`;
        return n;
      }
      inspect() {
        return { sql: this.sql, statement: this.statement, text: this.text, values: this.values };
      }
    };
    function bs(e, t = ",", r = "", n = "") {
      if (e.length === 0) throw new TypeError("Expected `join([])` to be called with an array of multiple elements, but got an empty array");
      return new ie([r, ...Array(e.length - 1).fill(t), n], e);
    }
    function Si(e) {
      return new ie([e], []);
    }
    var Es = Si("");
    function Ai(e, ...t) {
      return new ie(e, t);
    }
    function lr(e) {
      return { getKeys() {
        return Object.keys(e);
      }, getPropertyValue(t) {
        return e[t];
      } };
    }
    function re(e, t) {
      return { getKeys() {
        return [e];
      }, getPropertyValue() {
        return t();
      } };
    }
    var Pe = class {
      constructor() {
        this._map = /* @__PURE__ */ new Map();
      }
      get(t) {
        var _a7;
        return (_a7 = this._map.get(t)) == null ? void 0 : _a7.value;
      }
      set(t, r) {
        this._map.set(t, { value: r });
      }
      getOrCreate(t, r) {
        let n = this._map.get(t);
        if (n) return n.value;
        let i = r();
        return this.set(t, i), i;
      }
    };
    function it(e) {
      let t = new Pe();
      return { getKeys() {
        return e.getKeys();
      }, getPropertyValue(r) {
        return t.getOrCreate(r, () => e.getPropertyValue(r));
      }, getPropertyDescriptor(r) {
        var _a7;
        return (_a7 = e.getPropertyDescriptor) == null ? void 0 : _a7.call(e, r);
      } };
    }
    var rn = { enumerable: true, configurable: true, writable: true };
    function nn(e) {
      let t = new Set(e);
      return { getOwnPropertyDescriptor: () => rn, has: (r, n) => t.has(n), set: (r, n, i) => t.add(n) && Reflect.set(r, n, i), ownKeys: () => [...t] };
    }
    var ws = Symbol.for("nodejs.util.inspect.custom");
    function ve(e, t) {
      let r = bc(t), n = /* @__PURE__ */ new Set(), i = new Proxy(e, { get(o, s) {
        if (n.has(s)) return o[s];
        let a = r.get(s);
        return a ? a.getPropertyValue(s) : o[s];
      }, has(o, s) {
        var _a7, _b2;
        if (n.has(s)) return true;
        let a = r.get(s);
        return a ? (_b2 = (_a7 = a.has) == null ? void 0 : _a7.call(a, s)) != null ? _b2 : true : Reflect.has(o, s);
      }, ownKeys(o) {
        let s = xs(Reflect.ownKeys(o), r), a = xs(Array.from(r.keys()), r);
        return [.../* @__PURE__ */ new Set([...s, ...a, ...n])];
      }, set(o, s, a) {
        var _a7, _b2, _c2;
        return ((_c2 = (_b2 = (_a7 = r.get(s)) == null ? void 0 : _a7.getPropertyDescriptor) == null ? void 0 : _b2.call(_a7, s)) == null ? void 0 : _c2.writable) === false ? false : (n.add(s), Reflect.set(o, s, a));
      }, getOwnPropertyDescriptor(o, s) {
        let a = Reflect.getOwnPropertyDescriptor(o, s);
        if (a && !a.configurable) return a;
        let l = r.get(s);
        return l ? l.getPropertyDescriptor ? __spreadValues(__spreadValues({}, rn), l == null ? void 0 : l.getPropertyDescriptor(s)) : rn : a;
      }, defineProperty(o, s, a) {
        return n.add(s), Reflect.defineProperty(o, s, a);
      } });
      return i[ws] = function() {
        let o = __spreadValues({}, this);
        return delete o[ws], o;
      }, i;
    }
    function bc(e) {
      let t = /* @__PURE__ */ new Map();
      for (let r of e) {
        let n = r.getKeys();
        for (let i of n) t.set(i, r);
      }
      return t;
    }
    function xs(e, t) {
      return e.filter((r) => {
        var _a7, _b2, _c2;
        return (_c2 = (_b2 = (_a7 = t.get(r)) == null ? void 0 : _a7.has) == null ? void 0 : _b2.call(_a7, r)) != null ? _c2 : true;
      });
    }
    function Et(e) {
      return { getKeys() {
        return e;
      }, has() {
        return false;
      }, getPropertyValue() {
      } };
    }
    function wt(e, t) {
      return { batch: e, transaction: (t == null ? void 0 : t.kind) === "batch" ? { isolationLevel: t.options.isolationLevel } : void 0 };
    }
    var xt = class {
      constructor(t = 0, r) {
        this.context = r;
        this.lines = [];
        this.currentLine = "";
        this.currentIndent = 0;
        this.currentIndent = t;
      }
      write(t) {
        return typeof t == "string" ? this.currentLine += t : t.write(this), this;
      }
      writeJoined(t, r, n = (i, o) => o.write(i)) {
        let i = r.length - 1;
        for (let o = 0; o < r.length; o++) n(r[o], this), o !== i && this.write(t);
        return this;
      }
      writeLine(t) {
        return this.write(t).newLine();
      }
      newLine() {
        this.lines.push(this.indentedCurrentLine()), this.currentLine = "", this.marginSymbol = void 0;
        let t = this.afterNextNewLineCallback;
        return this.afterNextNewLineCallback = void 0, t == null ? void 0 : t(), this;
      }
      withIndent(t) {
        return this.indent(), t(this), this.unindent(), this;
      }
      afterNextNewline(t) {
        return this.afterNextNewLineCallback = t, this;
      }
      indent() {
        return this.currentIndent++, this;
      }
      unindent() {
        return this.currentIndent > 0 && this.currentIndent--, this;
      }
      addMarginSymbol(t) {
        return this.marginSymbol = t, this;
      }
      toString() {
        return this.lines.concat(this.indentedCurrentLine()).join(`
`);
      }
      getCurrentLineLength() {
        return this.currentLine.length;
      }
      indentedCurrentLine() {
        let t = this.currentLine.padStart(this.currentLine.length + 2 * this.currentIndent);
        return this.marginSymbol ? this.marginSymbol + t.slice(1) : t;
      }
    };
    function Ps(e) {
      return e.substring(0, 1).toLowerCase() + e.substring(1);
    }
    function Pt(e) {
      return e instanceof Date || Object.prototype.toString.call(e) === "[object Date]";
    }
    function on(e) {
      return e.toString() !== "Invalid Date";
    }
    var vt = 9e15;
    var ze = 1e9;
    var Ii = "0123456789abcdef";
    var an = "2.3025850929940456840179914546843642076011014886287729760333279009675726096773524802359972050895982983419677840422862486334095254650828067566662873690987816894829072083255546808437998948262331985283935053089653777326288461633662222876982198867465436674744042432743651550489343149393914796194044002221051017141748003688084012647080685567743216228355220114804663715659121373450747856947683463616792101806445070648000277502684916746550586856935673420670581136429224554405758925724208241314695689016758940256776311356919292033376587141660230105703089634572075440370847469940168269282808481184289314848524948644871927809676271275775397027668605952496716674183485704422507197965004714951050492214776567636938662976979522110718264549734772662425709429322582798502585509785265383207606726317164309505995087807523710333101197857547331541421808427543863591778117054309827482385045648019095610299291824318237525357709750539565187697510374970888692180205189339507238539205144634197265287286965110862571492198849978748873771345686209167058";
    var ln = "3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632789";
    var Oi = { precision: 20, rounding: 4, modulo: 1, toExpNeg: -7, toExpPos: 21, minE: -vt, maxE: vt, crypto: false };
    var Cs;
    var Me;
    var x = true;
    var cn = "[DecimalError] ";
    var Ke = cn + "Invalid argument: ";
    var Ss = cn + "Precision limit exceeded";
    var As = cn + "crypto unavailable";
    var Is = "[object Decimal]";
    var ee = Math.floor;
    var G = Math.pow;
    var Ec = /^0b([01]+(\.[01]*)?|\.[01]+)(p[+-]?\d+)?$/i;
    var wc = /^0x([0-9a-f]+(\.[0-9a-f]*)?|\.[0-9a-f]+)(p[+-]?\d+)?$/i;
    var xc = /^0o([0-7]+(\.[0-7]*)?|\.[0-7]+)(p[+-]?\d+)?$/i;
    var Os = /^(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i;
    var ge = 1e7;
    var b = 7;
    var Pc = 9007199254740991;
    var vc = an.length - 1;
    var ki = ln.length - 1;
    var m = { toStringTag: Is };
    m.absoluteValue = m.abs = function() {
      var e = new this.constructor(this);
      return e.s < 0 && (e.s = 1), y(e);
    };
    m.ceil = function() {
      return y(new this.constructor(this), this.e + 1, 2);
    };
    m.clampedTo = m.clamp = function(e, t) {
      var r, n = this, i = n.constructor;
      if (e = new i(e), t = new i(t), !e.s || !t.s) return new i(NaN);
      if (e.gt(t)) throw Error(Ke + t);
      return r = n.cmp(e), r < 0 ? e : n.cmp(t) > 0 ? t : new i(n);
    };
    m.comparedTo = m.cmp = function(e) {
      var t, r, n, i, o = this, s = o.d, a = (e = new o.constructor(e)).d, l = o.s, u = e.s;
      if (!s || !a) return !l || !u ? NaN : l !== u ? l : s === a ? 0 : !s ^ l < 0 ? 1 : -1;
      if (!s[0] || !a[0]) return s[0] ? l : a[0] ? -u : 0;
      if (l !== u) return l;
      if (o.e !== e.e) return o.e > e.e ^ l < 0 ? 1 : -1;
      for (n = s.length, i = a.length, t = 0, r = n < i ? n : i; t < r; ++t) if (s[t] !== a[t]) return s[t] > a[t] ^ l < 0 ? 1 : -1;
      return n === i ? 0 : n > i ^ l < 0 ? 1 : -1;
    };
    m.cosine = m.cos = function() {
      var e, t, r = this, n = r.constructor;
      return r.d ? r.d[0] ? (e = n.precision, t = n.rounding, n.precision = e + Math.max(r.e, r.sd()) + b, n.rounding = 1, r = Tc(n, Ls(n, r)), n.precision = e, n.rounding = t, y(Me == 2 || Me == 3 ? r.neg() : r, e, t, true)) : new n(1) : new n(NaN);
    };
    m.cubeRoot = m.cbrt = function() {
      var e, t, r, n, i, o, s, a, l, u, c = this, p = c.constructor;
      if (!c.isFinite() || c.isZero()) return new p(c);
      for (x = false, o = c.s * G(c.s * c, 1 / 3), !o || Math.abs(o) == 1 / 0 ? (r = K(c.d), e = c.e, (o = (e - r.length + 1) % 3) && (r += o == 1 || o == -2 ? "0" : "00"), o = G(r, 1 / 3), e = ee((e + 1) / 3) - (e % 3 == (e < 0 ? -1 : 2)), o == 1 / 0 ? r = "5e" + e : (r = o.toExponential(), r = r.slice(0, r.indexOf("e") + 1) + e), n = new p(r), n.s = c.s) : n = new p(o.toString()), s = (e = p.precision) + 3; ; ) if (a = n, l = a.times(a).times(a), u = l.plus(c), n = N(u.plus(c).times(a), u.plus(l), s + 2, 1), K(a.d).slice(0, s) === (r = K(n.d)).slice(0, s)) if (r = r.slice(s - 3, s + 1), r == "9999" || !i && r == "4999") {
        if (!i && (y(a, e + 1, 0), a.times(a).times(a).eq(c))) {
          n = a;
          break;
        }
        s += 4, i = 1;
      } else {
        (!+r || !+r.slice(1) && r.charAt(0) == "5") && (y(n, e + 1, 1), t = !n.times(n).times(n).eq(c));
        break;
      }
      return x = true, y(n, e, p.rounding, t);
    };
    m.decimalPlaces = m.dp = function() {
      var e, t = this.d, r = NaN;
      if (t) {
        if (e = t.length - 1, r = (e - ee(this.e / b)) * b, e = t[e], e) for (; e % 10 == 0; e /= 10) r--;
        r < 0 && (r = 0);
      }
      return r;
    };
    m.dividedBy = m.div = function(e) {
      return N(this, new this.constructor(e));
    };
    m.dividedToIntegerBy = m.divToInt = function(e) {
      var t = this, r = t.constructor;
      return y(N(t, new r(e), 0, 1, 1), r.precision, r.rounding);
    };
    m.equals = m.eq = function(e) {
      return this.cmp(e) === 0;
    };
    m.floor = function() {
      return y(new this.constructor(this), this.e + 1, 3);
    };
    m.greaterThan = m.gt = function(e) {
      return this.cmp(e) > 0;
    };
    m.greaterThanOrEqualTo = m.gte = function(e) {
      var t = this.cmp(e);
      return t == 1 || t === 0;
    };
    m.hyperbolicCosine = m.cosh = function() {
      var e, t, r, n, i, o = this, s = o.constructor, a = new s(1);
      if (!o.isFinite()) return new s(o.s ? 1 / 0 : NaN);
      if (o.isZero()) return a;
      r = s.precision, n = s.rounding, s.precision = r + Math.max(o.e, o.sd()) + 4, s.rounding = 1, i = o.d.length, i < 32 ? (e = Math.ceil(i / 3), t = (1 / dn(4, e)).toString()) : (e = 16, t = "2.3283064365386962890625e-10"), o = Tt(s, 1, o.times(t), new s(1), true);
      for (var l, u = e, c = new s(8); u--; ) l = o.times(o), o = a.minus(l.times(c.minus(l.times(c))));
      return y(o, s.precision = r, s.rounding = n, true);
    };
    m.hyperbolicSine = m.sinh = function() {
      var e, t, r, n, i = this, o = i.constructor;
      if (!i.isFinite() || i.isZero()) return new o(i);
      if (t = o.precision, r = o.rounding, o.precision = t + Math.max(i.e, i.sd()) + 4, o.rounding = 1, n = i.d.length, n < 3) i = Tt(o, 2, i, i, true);
      else {
        e = 1.4 * Math.sqrt(n), e = e > 16 ? 16 : e | 0, i = i.times(1 / dn(5, e)), i = Tt(o, 2, i, i, true);
        for (var s, a = new o(5), l = new o(16), u = new o(20); e--; ) s = i.times(i), i = i.times(a.plus(s.times(l.times(s).plus(u))));
      }
      return o.precision = t, o.rounding = r, y(i, t, r, true);
    };
    m.hyperbolicTangent = m.tanh = function() {
      var e, t, r = this, n = r.constructor;
      return r.isFinite() ? r.isZero() ? new n(r) : (e = n.precision, t = n.rounding, n.precision = e + 7, n.rounding = 1, N(r.sinh(), r.cosh(), n.precision = e, n.rounding = t)) : new n(r.s);
    };
    m.inverseCosine = m.acos = function() {
      var e, t = this, r = t.constructor, n = t.abs().cmp(1), i = r.precision, o = r.rounding;
      return n !== -1 ? n === 0 ? t.isNeg() ? fe(r, i, o) : new r(0) : new r(NaN) : t.isZero() ? fe(r, i + 4, o).times(0.5) : (r.precision = i + 6, r.rounding = 1, t = t.asin(), e = fe(r, i + 4, o).times(0.5), r.precision = i, r.rounding = o, e.minus(t));
    };
    m.inverseHyperbolicCosine = m.acosh = function() {
      var e, t, r = this, n = r.constructor;
      return r.lte(1) ? new n(r.eq(1) ? 0 : NaN) : r.isFinite() ? (e = n.precision, t = n.rounding, n.precision = e + Math.max(Math.abs(r.e), r.sd()) + 4, n.rounding = 1, x = false, r = r.times(r).minus(1).sqrt().plus(r), x = true, n.precision = e, n.rounding = t, r.ln()) : new n(r);
    };
    m.inverseHyperbolicSine = m.asinh = function() {
      var e, t, r = this, n = r.constructor;
      return !r.isFinite() || r.isZero() ? new n(r) : (e = n.precision, t = n.rounding, n.precision = e + 2 * Math.max(Math.abs(r.e), r.sd()) + 6, n.rounding = 1, x = false, r = r.times(r).plus(1).sqrt().plus(r), x = true, n.precision = e, n.rounding = t, r.ln());
    };
    m.inverseHyperbolicTangent = m.atanh = function() {
      var e, t, r, n, i = this, o = i.constructor;
      return i.isFinite() ? i.e >= 0 ? new o(i.abs().eq(1) ? i.s / 0 : i.isZero() ? i : NaN) : (e = o.precision, t = o.rounding, n = i.sd(), Math.max(n, e) < 2 * -i.e - 1 ? y(new o(i), e, t, true) : (o.precision = r = n - i.e, i = N(i.plus(1), new o(1).minus(i), r + e, 1), o.precision = e + 4, o.rounding = 1, i = i.ln(), o.precision = e, o.rounding = t, i.times(0.5))) : new o(NaN);
    };
    m.inverseSine = m.asin = function() {
      var e, t, r, n, i = this, o = i.constructor;
      return i.isZero() ? new o(i) : (t = i.abs().cmp(1), r = o.precision, n = o.rounding, t !== -1 ? t === 0 ? (e = fe(o, r + 4, n).times(0.5), e.s = i.s, e) : new o(NaN) : (o.precision = r + 6, o.rounding = 1, i = i.div(new o(1).minus(i.times(i)).sqrt().plus(1)).atan(), o.precision = r, o.rounding = n, i.times(2)));
    };
    m.inverseTangent = m.atan = function() {
      var e, t, r, n, i, o, s, a, l, u = this, c = u.constructor, p = c.precision, d = c.rounding;
      if (u.isFinite()) {
        if (u.isZero()) return new c(u);
        if (u.abs().eq(1) && p + 4 <= ki) return s = fe(c, p + 4, d).times(0.25), s.s = u.s, s;
      } else {
        if (!u.s) return new c(NaN);
        if (p + 4 <= ki) return s = fe(c, p + 4, d).times(0.5), s.s = u.s, s;
      }
      for (c.precision = a = p + 10, c.rounding = 1, r = Math.min(28, a / b + 2 | 0), e = r; e; --e) u = u.div(u.times(u).plus(1).sqrt().plus(1));
      for (x = false, t = Math.ceil(a / b), n = 1, l = u.times(u), s = new c(u), i = u; e !== -1; ) if (i = i.times(l), o = s.minus(i.div(n += 2)), i = i.times(l), s = o.plus(i.div(n += 2)), s.d[t] !== void 0) for (e = t; s.d[e] === o.d[e] && e--; ) ;
      return r && (s = s.times(2 << r - 1)), x = true, y(s, c.precision = p, c.rounding = d, true);
    };
    m.isFinite = function() {
      return !!this.d;
    };
    m.isInteger = m.isInt = function() {
      return !!this.d && ee(this.e / b) > this.d.length - 2;
    };
    m.isNaN = function() {
      return !this.s;
    };
    m.isNegative = m.isNeg = function() {
      return this.s < 0;
    };
    m.isPositive = m.isPos = function() {
      return this.s > 0;
    };
    m.isZero = function() {
      return !!this.d && this.d[0] === 0;
    };
    m.lessThan = m.lt = function(e) {
      return this.cmp(e) < 0;
    };
    m.lessThanOrEqualTo = m.lte = function(e) {
      return this.cmp(e) < 1;
    };
    m.logarithm = m.log = function(e) {
      var t, r, n, i, o, s, a, l, u = this, c = u.constructor, p = c.precision, d = c.rounding, f = 5;
      if (e == null) e = new c(10), t = true;
      else {
        if (e = new c(e), r = e.d, e.s < 0 || !r || !r[0] || e.eq(1)) return new c(NaN);
        t = e.eq(10);
      }
      if (r = u.d, u.s < 0 || !r || !r[0] || u.eq(1)) return new c(r && !r[0] ? -1 / 0 : u.s != 1 ? NaN : r ? 0 : 1 / 0);
      if (t) if (r.length > 1) o = true;
      else {
        for (i = r[0]; i % 10 === 0; ) i /= 10;
        o = i !== 1;
      }
      if (x = false, a = p + f, s = He(u, a), n = t ? un(c, a + 10) : He(e, a), l = N(s, n, a, 1), ur(l.d, i = p, d)) do
        if (a += 10, s = He(u, a), n = t ? un(c, a + 10) : He(e, a), l = N(s, n, a, 1), !o) {
          +K(l.d).slice(i + 1, i + 15) + 1 == 1e14 && (l = y(l, p + 1, 0));
          break;
        }
      while (ur(l.d, i += 10, d));
      return x = true, y(l, p, d);
    };
    m.minus = m.sub = function(e) {
      var t, r, n, i, o, s, a, l, u, c, p, d, f = this, g = f.constructor;
      if (e = new g(e), !f.d || !e.d) return !f.s || !e.s ? e = new g(NaN) : f.d ? e.s = -e.s : e = new g(e.d || f.s !== e.s ? f : NaN), e;
      if (f.s != e.s) return e.s = -e.s, f.plus(e);
      if (u = f.d, d = e.d, a = g.precision, l = g.rounding, !u[0] || !d[0]) {
        if (d[0]) e.s = -e.s;
        else if (u[0]) e = new g(f);
        else return new g(l === 3 ? -0 : 0);
        return x ? y(e, a, l) : e;
      }
      if (r = ee(e.e / b), c = ee(f.e / b), u = u.slice(), o = c - r, o) {
        for (p = o < 0, p ? (t = u, o = -o, s = d.length) : (t = d, r = c, s = u.length), n = Math.max(Math.ceil(a / b), s) + 2, o > n && (o = n, t.length = 1), t.reverse(), n = o; n--; ) t.push(0);
        t.reverse();
      } else {
        for (n = u.length, s = d.length, p = n < s, p && (s = n), n = 0; n < s; n++) if (u[n] != d[n]) {
          p = u[n] < d[n];
          break;
        }
        o = 0;
      }
      for (p && (t = u, u = d, d = t, e.s = -e.s), s = u.length, n = d.length - s; n > 0; --n) u[s++] = 0;
      for (n = d.length; n > o; ) {
        if (u[--n] < d[n]) {
          for (i = n; i && u[--i] === 0; ) u[i] = ge - 1;
          --u[i], u[n] += ge;
        }
        u[n] -= d[n];
      }
      for (; u[--s] === 0; ) u.pop();
      for (; u[0] === 0; u.shift()) --r;
      return u[0] ? (e.d = u, e.e = pn(u, r), x ? y(e, a, l) : e) : new g(l === 3 ? -0 : 0);
    };
    m.modulo = m.mod = function(e) {
      var t, r = this, n = r.constructor;
      return e = new n(e), !r.d || !e.s || e.d && !e.d[0] ? new n(NaN) : !e.d || r.d && !r.d[0] ? y(new n(r), n.precision, n.rounding) : (x = false, n.modulo == 9 ? (t = N(r, e.abs(), 0, 3, 1), t.s *= e.s) : t = N(r, e, 0, n.modulo, 1), t = t.times(e), x = true, r.minus(t));
    };
    m.naturalExponential = m.exp = function() {
      return Di(this);
    };
    m.naturalLogarithm = m.ln = function() {
      return He(this);
    };
    m.negated = m.neg = function() {
      var e = new this.constructor(this);
      return e.s = -e.s, y(e);
    };
    m.plus = m.add = function(e) {
      var t, r, n, i, o, s, a, l, u, c, p = this, d = p.constructor;
      if (e = new d(e), !p.d || !e.d) return !p.s || !e.s ? e = new d(NaN) : p.d || (e = new d(e.d || p.s === e.s ? p : NaN)), e;
      if (p.s != e.s) return e.s = -e.s, p.minus(e);
      if (u = p.d, c = e.d, a = d.precision, l = d.rounding, !u[0] || !c[0]) return c[0] || (e = new d(p)), x ? y(e, a, l) : e;
      if (o = ee(p.e / b), n = ee(e.e / b), u = u.slice(), i = o - n, i) {
        for (i < 0 ? (r = u, i = -i, s = c.length) : (r = c, n = o, s = u.length), o = Math.ceil(a / b), s = o > s ? o + 1 : s + 1, i > s && (i = s, r.length = 1), r.reverse(); i--; ) r.push(0);
        r.reverse();
      }
      for (s = u.length, i = c.length, s - i < 0 && (i = s, r = c, c = u, u = r), t = 0; i; ) t = (u[--i] = u[i] + c[i] + t) / ge | 0, u[i] %= ge;
      for (t && (u.unshift(t), ++n), s = u.length; u[--s] == 0; ) u.pop();
      return e.d = u, e.e = pn(u, n), x ? y(e, a, l) : e;
    };
    m.precision = m.sd = function(e) {
      var t, r = this;
      if (e !== void 0 && e !== !!e && e !== 1 && e !== 0) throw Error(Ke + e);
      return r.d ? (t = ks(r.d), e && r.e + 1 > t && (t = r.e + 1)) : t = NaN, t;
    };
    m.round = function() {
      var e = this, t = e.constructor;
      return y(new t(e), e.e + 1, t.rounding);
    };
    m.sine = m.sin = function() {
      var e, t, r = this, n = r.constructor;
      return r.isFinite() ? r.isZero() ? new n(r) : (e = n.precision, t = n.rounding, n.precision = e + Math.max(r.e, r.sd()) + b, n.rounding = 1, r = Cc(n, Ls(n, r)), n.precision = e, n.rounding = t, y(Me > 2 ? r.neg() : r, e, t, true)) : new n(NaN);
    };
    m.squareRoot = m.sqrt = function() {
      var e, t, r, n, i, o, s = this, a = s.d, l = s.e, u = s.s, c = s.constructor;
      if (u !== 1 || !a || !a[0]) return new c(!u || u < 0 && (!a || a[0]) ? NaN : a ? s : 1 / 0);
      for (x = false, u = Math.sqrt(+s), u == 0 || u == 1 / 0 ? (t = K(a), (t.length + l) % 2 == 0 && (t += "0"), u = Math.sqrt(t), l = ee((l + 1) / 2) - (l < 0 || l % 2), u == 1 / 0 ? t = "5e" + l : (t = u.toExponential(), t = t.slice(0, t.indexOf("e") + 1) + l), n = new c(t)) : n = new c(u.toString()), r = (l = c.precision) + 3; ; ) if (o = n, n = o.plus(N(s, o, r + 2, 1)).times(0.5), K(o.d).slice(0, r) === (t = K(n.d)).slice(0, r)) if (t = t.slice(r - 3, r + 1), t == "9999" || !i && t == "4999") {
        if (!i && (y(o, l + 1, 0), o.times(o).eq(s))) {
          n = o;
          break;
        }
        r += 4, i = 1;
      } else {
        (!+t || !+t.slice(1) && t.charAt(0) == "5") && (y(n, l + 1, 1), e = !n.times(n).eq(s));
        break;
      }
      return x = true, y(n, l, c.rounding, e);
    };
    m.tangent = m.tan = function() {
      var e, t, r = this, n = r.constructor;
      return r.isFinite() ? r.isZero() ? new n(r) : (e = n.precision, t = n.rounding, n.precision = e + 10, n.rounding = 1, r = r.sin(), r.s = 1, r = N(r, new n(1).minus(r.times(r)).sqrt(), e + 10, 0), n.precision = e, n.rounding = t, y(Me == 2 || Me == 4 ? r.neg() : r, e, t, true)) : new n(NaN);
    };
    m.times = m.mul = function(e) {
      var t, r, n, i, o, s, a, l, u, c = this, p = c.constructor, d = c.d, f = (e = new p(e)).d;
      if (e.s *= c.s, !d || !d[0] || !f || !f[0]) return new p(!e.s || d && !d[0] && !f || f && !f[0] && !d ? NaN : !d || !f ? e.s / 0 : e.s * 0);
      for (r = ee(c.e / b) + ee(e.e / b), l = d.length, u = f.length, l < u && (o = d, d = f, f = o, s = l, l = u, u = s), o = [], s = l + u, n = s; n--; ) o.push(0);
      for (n = u; --n >= 0; ) {
        for (t = 0, i = l + n; i > n; ) a = o[i] + f[n] * d[i - n - 1] + t, o[i--] = a % ge | 0, t = a / ge | 0;
        o[i] = (o[i] + t) % ge | 0;
      }
      for (; !o[--s]; ) o.pop();
      return t ? ++r : o.shift(), e.d = o, e.e = pn(o, r), x ? y(e, p.precision, p.rounding) : e;
    };
    m.toBinary = function(e, t) {
      return Fi(this, 2, e, t);
    };
    m.toDecimalPlaces = m.toDP = function(e, t) {
      var r = this, n = r.constructor;
      return r = new n(r), e === void 0 ? r : (oe(e, 0, ze), t === void 0 ? t = n.rounding : oe(t, 0, 8), y(r, e + r.e + 1, t));
    };
    m.toExponential = function(e, t) {
      var r, n = this, i = n.constructor;
      return e === void 0 ? r = Te(n, true) : (oe(e, 0, ze), t === void 0 ? t = i.rounding : oe(t, 0, 8), n = y(new i(n), e + 1, t), r = Te(n, true, e + 1)), n.isNeg() && !n.isZero() ? "-" + r : r;
    };
    m.toFixed = function(e, t) {
      var r, n, i = this, o = i.constructor;
      return e === void 0 ? r = Te(i) : (oe(e, 0, ze), t === void 0 ? t = o.rounding : oe(t, 0, 8), n = y(new o(i), e + i.e + 1, t), r = Te(n, false, e + n.e + 1)), i.isNeg() && !i.isZero() ? "-" + r : r;
    };
    m.toFraction = function(e) {
      var t, r, n, i, o, s, a, l, u, c, p, d, f = this, g = f.d, h = f.constructor;
      if (!g) return new h(f);
      if (u = r = new h(1), n = l = new h(0), t = new h(n), o = t.e = ks(g) - f.e - 1, s = o % b, t.d[0] = G(10, s < 0 ? b + s : s), e == null) e = o > 0 ? t : u;
      else {
        if (a = new h(e), !a.isInt() || a.lt(u)) throw Error(Ke + a);
        e = a.gt(t) ? o > 0 ? t : u : a;
      }
      for (x = false, a = new h(K(g)), c = h.precision, h.precision = o = g.length * b * 2; p = N(a, t, 0, 1, 1), i = r.plus(p.times(n)), i.cmp(e) != 1; ) r = n, n = i, i = u, u = l.plus(p.times(i)), l = i, i = t, t = a.minus(p.times(i)), a = i;
      return i = N(e.minus(r), n, 0, 1, 1), l = l.plus(i.times(u)), r = r.plus(i.times(n)), l.s = u.s = f.s, d = N(u, n, o, 1).minus(f).abs().cmp(N(l, r, o, 1).minus(f).abs()) < 1 ? [u, n] : [l, r], h.precision = c, x = true, d;
    };
    m.toHexadecimal = m.toHex = function(e, t) {
      return Fi(this, 16, e, t);
    };
    m.toNearest = function(e, t) {
      var r = this, n = r.constructor;
      if (r = new n(r), e == null) {
        if (!r.d) return r;
        e = new n(1), t = n.rounding;
      } else {
        if (e = new n(e), t === void 0 ? t = n.rounding : oe(t, 0, 8), !r.d) return e.s ? r : e;
        if (!e.d) return e.s && (e.s = r.s), e;
      }
      return e.d[0] ? (x = false, r = N(r, e, 0, t, 1).times(e), x = true, y(r)) : (e.s = r.s, r = e), r;
    };
    m.toNumber = function() {
      return +this;
    };
    m.toOctal = function(e, t) {
      return Fi(this, 8, e, t);
    };
    m.toPower = m.pow = function(e) {
      var t, r, n, i, o, s, a = this, l = a.constructor, u = +(e = new l(e));
      if (!a.d || !e.d || !a.d[0] || !e.d[0]) return new l(G(+a, u));
      if (a = new l(a), a.eq(1)) return a;
      if (n = l.precision, o = l.rounding, e.eq(1)) return y(a, n, o);
      if (t = ee(e.e / b), t >= e.d.length - 1 && (r = u < 0 ? -u : u) <= Pc) return i = Ds(l, a, r, n), e.s < 0 ? new l(1).div(i) : y(i, n, o);
      if (s = a.s, s < 0) {
        if (t < e.d.length - 1) return new l(NaN);
        if (e.d[t] & 1 || (s = 1), a.e == 0 && a.d[0] == 1 && a.d.length == 1) return a.s = s, a;
      }
      return r = G(+a, u), t = r == 0 || !isFinite(r) ? ee(u * (Math.log("0." + K(a.d)) / Math.LN10 + a.e + 1)) : new l(r + "").e, t > l.maxE + 1 || t < l.minE - 1 ? new l(t > 0 ? s / 0 : 0) : (x = false, l.rounding = a.s = 1, r = Math.min(12, (t + "").length), i = Di(e.times(He(a, n + r)), n), i.d && (i = y(i, n + 5, 1), ur(i.d, n, o) && (t = n + 10, i = y(Di(e.times(He(a, t + r)), t), t + 5, 1), +K(i.d).slice(n + 1, n + 15) + 1 == 1e14 && (i = y(i, n + 1, 0)))), i.s = s, x = true, l.rounding = o, y(i, n, o));
    };
    m.toPrecision = function(e, t) {
      var r, n = this, i = n.constructor;
      return e === void 0 ? r = Te(n, n.e <= i.toExpNeg || n.e >= i.toExpPos) : (oe(e, 1, ze), t === void 0 ? t = i.rounding : oe(t, 0, 8), n = y(new i(n), e, t), r = Te(n, e <= n.e || n.e <= i.toExpNeg, e)), n.isNeg() && !n.isZero() ? "-" + r : r;
    };
    m.toSignificantDigits = m.toSD = function(e, t) {
      var r = this, n = r.constructor;
      return e === void 0 ? (e = n.precision, t = n.rounding) : (oe(e, 1, ze), t === void 0 ? t = n.rounding : oe(t, 0, 8)), y(new n(r), e, t);
    };
    m.toString = function() {
      var e = this, t = e.constructor, r = Te(e, e.e <= t.toExpNeg || e.e >= t.toExpPos);
      return e.isNeg() && !e.isZero() ? "-" + r : r;
    };
    m.truncated = m.trunc = function() {
      return y(new this.constructor(this), this.e + 1, 1);
    };
    m.valueOf = m.toJSON = function() {
      var e = this, t = e.constructor, r = Te(e, e.e <= t.toExpNeg || e.e >= t.toExpPos);
      return e.isNeg() ? "-" + r : r;
    };
    function K(e) {
      var t, r, n, i = e.length - 1, o = "", s = e[0];
      if (i > 0) {
        for (o += s, t = 1; t < i; t++) n = e[t] + "", r = b - n.length, r && (o += We(r)), o += n;
        s = e[t], n = s + "", r = b - n.length, r && (o += We(r));
      } else if (s === 0) return "0";
      for (; s % 10 === 0; ) s /= 10;
      return o + s;
    }
    function oe(e, t, r) {
      if (e !== ~~e || e < t || e > r) throw Error(Ke + e);
    }
    function ur(e, t, r, n) {
      var i, o, s, a;
      for (o = e[0]; o >= 10; o /= 10) --t;
      return --t < 0 ? (t += b, i = 0) : (i = Math.ceil((t + 1) / b), t %= b), o = G(10, b - t), a = e[i] % o | 0, n == null ? t < 3 ? (t == 0 ? a = a / 100 | 0 : t == 1 && (a = a / 10 | 0), s = r < 4 && a == 99999 || r > 3 && a == 49999 || a == 5e4 || a == 0) : s = (r < 4 && a + 1 == o || r > 3 && a + 1 == o / 2) && (e[i + 1] / o / 100 | 0) == G(10, t - 2) - 1 || (a == o / 2 || a == 0) && (e[i + 1] / o / 100 | 0) == 0 : t < 4 ? (t == 0 ? a = a / 1e3 | 0 : t == 1 ? a = a / 100 | 0 : t == 2 && (a = a / 10 | 0), s = (n || r < 4) && a == 9999 || !n && r > 3 && a == 4999) : s = ((n || r < 4) && a + 1 == o || !n && r > 3 && a + 1 == o / 2) && (e[i + 1] / o / 1e3 | 0) == G(10, t - 3) - 1, s;
    }
    function sn(e, t, r) {
      for (var n, i = [0], o, s = 0, a = e.length; s < a; ) {
        for (o = i.length; o--; ) i[o] *= t;
        for (i[0] += Ii.indexOf(e.charAt(s++)), n = 0; n < i.length; n++) i[n] > r - 1 && (i[n + 1] === void 0 && (i[n + 1] = 0), i[n + 1] += i[n] / r | 0, i[n] %= r);
      }
      return i.reverse();
    }
    function Tc(e, t) {
      var r, n, i;
      if (t.isZero()) return t;
      n = t.d.length, n < 32 ? (r = Math.ceil(n / 3), i = (1 / dn(4, r)).toString()) : (r = 16, i = "2.3283064365386962890625e-10"), e.precision += r, t = Tt(e, 1, t.times(i), new e(1));
      for (var o = r; o--; ) {
        var s = t.times(t);
        t = s.times(s).minus(s).times(8).plus(1);
      }
      return e.precision -= r, t;
    }
    var N = /* @__PURE__ */ function() {
      function e(n, i, o) {
        var s, a = 0, l = n.length;
        for (n = n.slice(); l--; ) s = n[l] * i + a, n[l] = s % o | 0, a = s / o | 0;
        return a && n.unshift(a), n;
      }
      function t(n, i, o, s) {
        var a, l;
        if (o != s) l = o > s ? 1 : -1;
        else for (a = l = 0; a < o; a++) if (n[a] != i[a]) {
          l = n[a] > i[a] ? 1 : -1;
          break;
        }
        return l;
      }
      function r(n, i, o, s) {
        for (var a = 0; o--; ) n[o] -= a, a = n[o] < i[o] ? 1 : 0, n[o] = a * s + n[o] - i[o];
        for (; !n[0] && n.length > 1; ) n.shift();
      }
      return function(n, i, o, s, a, l) {
        var u, c, p, d, f, g, h, O, T, S, C, E, me, ae, jt, U, ne, Ie, z, dt, Fr = n.constructor, $n = n.s == i.s ? 1 : -1, Y = n.d, _ = i.d;
        if (!Y || !Y[0] || !_ || !_[0]) return new Fr(!n.s || !i.s || (Y ? _ && Y[0] == _[0] : !_) ? NaN : Y && Y[0] == 0 || !_ ? $n * 0 : $n / 0);
        for (l ? (f = 1, c = n.e - i.e) : (l = ge, f = b, c = ee(n.e / f) - ee(i.e / f)), z = _.length, ne = Y.length, T = new Fr($n), S = T.d = [], p = 0; _[p] == (Y[p] || 0); p++) ;
        if (_[p] > (Y[p] || 0) && c--, o == null ? (ae = o = Fr.precision, s = Fr.rounding) : a ? ae = o + (n.e - i.e) + 1 : ae = o, ae < 0) S.push(1), g = true;
        else {
          if (ae = ae / f + 2 | 0, p = 0, z == 1) {
            for (d = 0, _ = _[0], ae++; (p < ne || d) && ae--; p++) jt = d * l + (Y[p] || 0), S[p] = jt / _ | 0, d = jt % _ | 0;
            g = d || p < ne;
          } else {
            for (d = l / (_[0] + 1) | 0, d > 1 && (_ = e(_, d, l), Y = e(Y, d, l), z = _.length, ne = Y.length), U = z, C = Y.slice(0, z), E = C.length; E < z; ) C[E++] = 0;
            dt = _.slice(), dt.unshift(0), Ie = _[0], _[1] >= l / 2 && ++Ie;
            do
              d = 0, u = t(_, C, z, E), u < 0 ? (me = C[0], z != E && (me = me * l + (C[1] || 0)), d = me / Ie | 0, d > 1 ? (d >= l && (d = l - 1), h = e(_, d, l), O = h.length, E = C.length, u = t(h, C, O, E), u == 1 && (d--, r(h, z < O ? dt : _, O, l))) : (d == 0 && (u = d = 1), h = _.slice()), O = h.length, O < E && h.unshift(0), r(C, h, E, l), u == -1 && (E = C.length, u = t(_, C, z, E), u < 1 && (d++, r(C, z < E ? dt : _, E, l))), E = C.length) : u === 0 && (d++, C = [0]), S[p++] = d, u && C[0] ? C[E++] = Y[U] || 0 : (C = [Y[U]], E = 1);
            while ((U++ < ne || C[0] !== void 0) && ae--);
            g = C[0] !== void 0;
          }
          S[0] || S.shift();
        }
        if (f == 1) T.e = c, Cs = g;
        else {
          for (p = 1, d = S[0]; d >= 10; d /= 10) p++;
          T.e = p + c * f - 1, y(T, a ? o + T.e + 1 : o, s, g);
        }
        return T;
      };
    }();
    function y(e, t, r, n) {
      var i, o, s, a, l, u, c, p, d, f = e.constructor;
      e: if (t != null) {
        if (p = e.d, !p) return e;
        for (i = 1, a = p[0]; a >= 10; a /= 10) i++;
        if (o = t - i, o < 0) o += b, s = t, c = p[d = 0], l = c / G(10, i - s - 1) % 10 | 0;
        else if (d = Math.ceil((o + 1) / b), a = p.length, d >= a) if (n) {
          for (; a++ <= d; ) p.push(0);
          c = l = 0, i = 1, o %= b, s = o - b + 1;
        } else break e;
        else {
          for (c = a = p[d], i = 1; a >= 10; a /= 10) i++;
          o %= b, s = o - b + i, l = s < 0 ? 0 : c / G(10, i - s - 1) % 10 | 0;
        }
        if (n = n || t < 0 || p[d + 1] !== void 0 || (s < 0 ? c : c % G(10, i - s - 1)), u = r < 4 ? (l || n) && (r == 0 || r == (e.s < 0 ? 3 : 2)) : l > 5 || l == 5 && (r == 4 || n || r == 6 && (o > 0 ? s > 0 ? c / G(10, i - s) : 0 : p[d - 1]) % 10 & 1 || r == (e.s < 0 ? 8 : 7)), t < 1 || !p[0]) return p.length = 0, u ? (t -= e.e + 1, p[0] = G(10, (b - t % b) % b), e.e = -t || 0) : p[0] = e.e = 0, e;
        if (o == 0 ? (p.length = d, a = 1, d--) : (p.length = d + 1, a = G(10, b - o), p[d] = s > 0 ? (c / G(10, i - s) % G(10, s) | 0) * a : 0), u) for (; ; ) if (d == 0) {
          for (o = 1, s = p[0]; s >= 10; s /= 10) o++;
          for (s = p[0] += a, a = 1; s >= 10; s /= 10) a++;
          o != a && (e.e++, p[0] == ge && (p[0] = 1));
          break;
        } else {
          if (p[d] += a, p[d] != ge) break;
          p[d--] = 0, a = 1;
        }
        for (o = p.length; p[--o] === 0; ) p.pop();
      }
      return x && (e.e > f.maxE ? (e.d = null, e.e = NaN) : e.e < f.minE && (e.e = 0, e.d = [0])), e;
    }
    function Te(e, t, r) {
      if (!e.isFinite()) return Fs(e);
      var n, i = e.e, o = K(e.d), s = o.length;
      return t ? (r && (n = r - s) > 0 ? o = o.charAt(0) + "." + o.slice(1) + We(n) : s > 1 && (o = o.charAt(0) + "." + o.slice(1)), o = o + (e.e < 0 ? "e" : "e+") + e.e) : i < 0 ? (o = "0." + We(-i - 1) + o, r && (n = r - s) > 0 && (o += We(n))) : i >= s ? (o += We(i + 1 - s), r && (n = r - i - 1) > 0 && (o = o + "." + We(n))) : ((n = i + 1) < s && (o = o.slice(0, n) + "." + o.slice(n)), r && (n = r - s) > 0 && (i + 1 === s && (o += "."), o += We(n))), o;
    }
    function pn(e, t) {
      var r = e[0];
      for (t *= b; r >= 10; r /= 10) t++;
      return t;
    }
    function un(e, t, r) {
      if (t > vc) throw x = true, r && (e.precision = r), Error(Ss);
      return y(new e(an), t, 1, true);
    }
    function fe(e, t, r) {
      if (t > ki) throw Error(Ss);
      return y(new e(ln), t, r, true);
    }
    function ks(e) {
      var t = e.length - 1, r = t * b + 1;
      if (t = e[t], t) {
        for (; t % 10 == 0; t /= 10) r--;
        for (t = e[0]; t >= 10; t /= 10) r++;
      }
      return r;
    }
    function We(e) {
      for (var t = ""; e--; ) t += "0";
      return t;
    }
    function Ds(e, t, r, n) {
      var i, o = new e(1), s = Math.ceil(n / b + 4);
      for (x = false; ; ) {
        if (r % 2 && (o = o.times(t), Ts(o.d, s) && (i = true)), r = ee(r / 2), r === 0) {
          r = o.d.length - 1, i && o.d[r] === 0 && ++o.d[r];
          break;
        }
        t = t.times(t), Ts(t.d, s);
      }
      return x = true, o;
    }
    function vs(e) {
      return e.d[e.d.length - 1] & 1;
    }
    function _s(e, t, r) {
      for (var n, i = new e(t[0]), o = 0; ++o < t.length; ) if (n = new e(t[o]), n.s) i[r](n) && (i = n);
      else {
        i = n;
        break;
      }
      return i;
    }
    function Di(e, t) {
      var r, n, i, o, s, a, l, u = 0, c = 0, p = 0, d = e.constructor, f = d.rounding, g = d.precision;
      if (!e.d || !e.d[0] || e.e > 17) return new d(e.d ? e.d[0] ? e.s < 0 ? 0 : 1 / 0 : 1 : e.s ? e.s < 0 ? 0 : e : NaN);
      for (t == null ? (x = false, l = g) : l = t, a = new d(0.03125); e.e > -2; ) e = e.times(a), p += 5;
      for (n = Math.log(G(2, p)) / Math.LN10 * 2 + 5 | 0, l += n, r = o = s = new d(1), d.precision = l; ; ) {
        if (o = y(o.times(e), l, 1), r = r.times(++c), a = s.plus(N(o, r, l, 1)), K(a.d).slice(0, l) === K(s.d).slice(0, l)) {
          for (i = p; i--; ) s = y(s.times(s), l, 1);
          if (t == null) if (u < 3 && ur(s.d, l - n, f, u)) d.precision = l += 10, r = o = a = new d(1), c = 0, u++;
          else return y(s, d.precision = g, f, x = true);
          else return d.precision = g, s;
        }
        s = a;
      }
    }
    function He(e, t) {
      var r, n, i, o, s, a, l, u, c, p, d, f = 1, g = 10, h = e, O = h.d, T = h.constructor, S = T.rounding, C = T.precision;
      if (h.s < 0 || !O || !O[0] || !h.e && O[0] == 1 && O.length == 1) return new T(O && !O[0] ? -1 / 0 : h.s != 1 ? NaN : O ? 0 : h);
      if (t == null ? (x = false, c = C) : c = t, T.precision = c += g, r = K(O), n = r.charAt(0), Math.abs(o = h.e) < 15e14) {
        for (; n < 7 && n != 1 || n == 1 && r.charAt(1) > 3; ) h = h.times(e), r = K(h.d), n = r.charAt(0), f++;
        o = h.e, n > 1 ? (h = new T("0." + r), o++) : h = new T(n + "." + r.slice(1));
      } else return u = un(T, c + 2, C).times(o + ""), h = He(new T(n + "." + r.slice(1)), c - g).plus(u), T.precision = C, t == null ? y(h, C, S, x = true) : h;
      for (p = h, l = s = h = N(h.minus(1), h.plus(1), c, 1), d = y(h.times(h), c, 1), i = 3; ; ) {
        if (s = y(s.times(d), c, 1), u = l.plus(N(s, new T(i), c, 1)), K(u.d).slice(0, c) === K(l.d).slice(0, c)) if (l = l.times(2), o !== 0 && (l = l.plus(un(T, c + 2, C).times(o + ""))), l = N(l, new T(f), c, 1), t == null) if (ur(l.d, c - g, S, a)) T.precision = c += g, u = s = h = N(p.minus(1), p.plus(1), c, 1), d = y(h.times(h), c, 1), i = a = 1;
        else return y(l, T.precision = C, S, x = true);
        else return T.precision = C, l;
        l = u, i += 2;
      }
    }
    function Fs(e) {
      return String(e.s * e.s / 0);
    }
    function _i(e, t) {
      var r, n, i;
      for ((r = t.indexOf(".")) > -1 && (t = t.replace(".", "")), (n = t.search(/e/i)) > 0 ? (r < 0 && (r = n), r += +t.slice(n + 1), t = t.substring(0, n)) : r < 0 && (r = t.length), n = 0; t.charCodeAt(n) === 48; n++) ;
      for (i = t.length; t.charCodeAt(i - 1) === 48; --i) ;
      if (t = t.slice(n, i), t) {
        if (i -= n, e.e = r = r - n - 1, e.d = [], n = (r + 1) % b, r < 0 && (n += b), n < i) {
          for (n && e.d.push(+t.slice(0, n)), i -= b; n < i; ) e.d.push(+t.slice(n, n += b));
          t = t.slice(n), n = b - t.length;
        } else n -= i;
        for (; n--; ) t += "0";
        e.d.push(+t), x && (e.e > e.constructor.maxE ? (e.d = null, e.e = NaN) : e.e < e.constructor.minE && (e.e = 0, e.d = [0]));
      } else e.e = 0, e.d = [0];
      return e;
    }
    function Rc(e, t) {
      var r, n, i, o, s, a, l, u, c;
      if (t.indexOf("_") > -1) {
        if (t = t.replace(/(\d)_(?=\d)/g, "$1"), Os.test(t)) return _i(e, t);
      } else if (t === "Infinity" || t === "NaN") return +t || (e.s = NaN), e.e = NaN, e.d = null, e;
      if (wc.test(t)) r = 16, t = t.toLowerCase();
      else if (Ec.test(t)) r = 2;
      else if (xc.test(t)) r = 8;
      else throw Error(Ke + t);
      for (o = t.search(/p/i), o > 0 ? (l = +t.slice(o + 1), t = t.substring(2, o)) : t = t.slice(2), o = t.indexOf("."), s = o >= 0, n = e.constructor, s && (t = t.replace(".", ""), a = t.length, o = a - o, i = Ds(n, new n(r), o, o * 2)), u = sn(t, r, ge), c = u.length - 1, o = c; u[o] === 0; --o) u.pop();
      return o < 0 ? new n(e.s * 0) : (e.e = pn(u, c), e.d = u, x = false, s && (e = N(e, i, a * 4)), l && (e = e.times(Math.abs(l) < 54 ? G(2, l) : ot.pow(2, l))), x = true, e);
    }
    function Cc(e, t) {
      var r, n = t.d.length;
      if (n < 3) return t.isZero() ? t : Tt(e, 2, t, t);
      r = 1.4 * Math.sqrt(n), r = r > 16 ? 16 : r | 0, t = t.times(1 / dn(5, r)), t = Tt(e, 2, t, t);
      for (var i, o = new e(5), s = new e(16), a = new e(20); r--; ) i = t.times(t), t = t.times(o.plus(i.times(s.times(i).minus(a))));
      return t;
    }
    function Tt(e, t, r, n, i) {
      var o, s, a, l, u = 1, c = e.precision, p = Math.ceil(c / b);
      for (x = false, l = r.times(r), a = new e(n); ; ) {
        if (s = N(a.times(l), new e(t++ * t++), c, 1), a = i ? n.plus(s) : n.minus(s), n = N(s.times(l), new e(t++ * t++), c, 1), s = a.plus(n), s.d[p] !== void 0) {
          for (o = p; s.d[o] === a.d[o] && o--; ) ;
          if (o == -1) break;
        }
        o = a, a = n, n = s, s = o, u++;
      }
      return x = true, s.d.length = p + 1, s;
    }
    function dn(e, t) {
      for (var r = e; --t; ) r *= e;
      return r;
    }
    function Ls(e, t) {
      var r, n = t.s < 0, i = fe(e, e.precision, 1), o = i.times(0.5);
      if (t = t.abs(), t.lte(o)) return Me = n ? 4 : 1, t;
      if (r = t.divToInt(i), r.isZero()) Me = n ? 3 : 2;
      else {
        if (t = t.minus(r.times(i)), t.lte(o)) return Me = vs(r) ? n ? 2 : 3 : n ? 4 : 1, t;
        Me = vs(r) ? n ? 1 : 4 : n ? 3 : 2;
      }
      return t.minus(i).abs();
    }
    function Fi(e, t, r, n) {
      var i, o, s, a, l, u, c, p, d, f = e.constructor, g = r !== void 0;
      if (g ? (oe(r, 1, ze), n === void 0 ? n = f.rounding : oe(n, 0, 8)) : (r = f.precision, n = f.rounding), !e.isFinite()) c = Fs(e);
      else {
        for (c = Te(e), s = c.indexOf("."), g ? (i = 2, t == 16 ? r = r * 4 - 3 : t == 8 && (r = r * 3 - 2)) : i = t, s >= 0 && (c = c.replace(".", ""), d = new f(1), d.e = c.length - s, d.d = sn(Te(d), 10, i), d.e = d.d.length), p = sn(c, 10, i), o = l = p.length; p[--l] == 0; ) p.pop();
        if (!p[0]) c = g ? "0p+0" : "0";
        else {
          if (s < 0 ? o-- : (e = new f(e), e.d = p, e.e = o, e = N(e, d, r, n, 0, i), p = e.d, o = e.e, u = Cs), s = p[r], a = i / 2, u = u || p[r + 1] !== void 0, u = n < 4 ? (s !== void 0 || u) && (n === 0 || n === (e.s < 0 ? 3 : 2)) : s > a || s === a && (n === 4 || u || n === 6 && p[r - 1] & 1 || n === (e.s < 0 ? 8 : 7)), p.length = r, u) for (; ++p[--r] > i - 1; ) p[r] = 0, r || (++o, p.unshift(1));
          for (l = p.length; !p[l - 1]; --l) ;
          for (s = 0, c = ""; s < l; s++) c += Ii.charAt(p[s]);
          if (g) {
            if (l > 1) if (t == 16 || t == 8) {
              for (s = t == 16 ? 4 : 3, --l; l % s; l++) c += "0";
              for (p = sn(c, i, t), l = p.length; !p[l - 1]; --l) ;
              for (s = 1, c = "1."; s < l; s++) c += Ii.charAt(p[s]);
            } else c = c.charAt(0) + "." + c.slice(1);
            c = c + (o < 0 ? "p" : "p+") + o;
          } else if (o < 0) {
            for (; ++o; ) c = "0" + c;
            c = "0." + c;
          } else if (++o > l) for (o -= l; o--; ) c += "0";
          else o < l && (c = c.slice(0, o) + "." + c.slice(o));
        }
        c = (t == 16 ? "0x" : t == 2 ? "0b" : t == 8 ? "0o" : "") + c;
      }
      return e.s < 0 ? "-" + c : c;
    }
    function Ts(e, t) {
      if (e.length > t) return e.length = t, true;
    }
    function Sc(e) {
      return new this(e).abs();
    }
    function Ac(e) {
      return new this(e).acos();
    }
    function Ic(e) {
      return new this(e).acosh();
    }
    function Oc(e, t) {
      return new this(e).plus(t);
    }
    function kc(e) {
      return new this(e).asin();
    }
    function Dc(e) {
      return new this(e).asinh();
    }
    function _c(e) {
      return new this(e).atan();
    }
    function Fc(e) {
      return new this(e).atanh();
    }
    function Lc(e, t) {
      e = new this(e), t = new this(t);
      var r, n = this.precision, i = this.rounding, o = n + 4;
      return !e.s || !t.s ? r = new this(NaN) : !e.d && !t.d ? (r = fe(this, o, 1).times(t.s > 0 ? 0.25 : 0.75), r.s = e.s) : !t.d || e.isZero() ? (r = t.s < 0 ? fe(this, n, i) : new this(0), r.s = e.s) : !e.d || t.isZero() ? (r = fe(this, o, 1).times(0.5), r.s = e.s) : t.s < 0 ? (this.precision = o, this.rounding = 1, r = this.atan(N(e, t, o, 1)), t = fe(this, o, 1), this.precision = n, this.rounding = i, r = e.s < 0 ? r.minus(t) : r.plus(t)) : r = this.atan(N(e, t, o, 1)), r;
    }
    function Nc(e) {
      return new this(e).cbrt();
    }
    function Mc(e) {
      return y(e = new this(e), e.e + 1, 2);
    }
    function $c(e, t, r) {
      return new this(e).clamp(t, r);
    }
    function qc(e) {
      if (!e || typeof e != "object") throw Error(cn + "Object expected");
      var t, r, n, i = e.defaults === true, o = ["precision", 1, ze, "rounding", 0, 8, "toExpNeg", -vt, 0, "toExpPos", 0, vt, "maxE", 0, vt, "minE", -vt, 0, "modulo", 0, 9];
      for (t = 0; t < o.length; t += 3) if (r = o[t], i && (this[r] = Oi[r]), (n = e[r]) !== void 0) if (ee(n) === n && n >= o[t + 1] && n <= o[t + 2]) this[r] = n;
      else throw Error(Ke + r + ": " + n);
      if (r = "crypto", i && (this[r] = Oi[r]), (n = e[r]) !== void 0) if (n === true || n === false || n === 0 || n === 1) if (n) if (typeof crypto < "u" && crypto && (crypto.getRandomValues || crypto.randomBytes)) this[r] = true;
      else throw Error(As);
      else this[r] = false;
      else throw Error(Ke + r + ": " + n);
      return this;
    }
    function jc(e) {
      return new this(e).cos();
    }
    function Vc(e) {
      return new this(e).cosh();
    }
    function Ns(e) {
      var t, r, n;
      function i(o) {
        var s, a, l, u = this;
        if (!(u instanceof i)) return new i(o);
        if (u.constructor = i, Rs(o)) {
          u.s = o.s, x ? !o.d || o.e > i.maxE ? (u.e = NaN, u.d = null) : o.e < i.minE ? (u.e = 0, u.d = [0]) : (u.e = o.e, u.d = o.d.slice()) : (u.e = o.e, u.d = o.d ? o.d.slice() : o.d);
          return;
        }
        if (l = typeof o, l === "number") {
          if (o === 0) {
            u.s = 1 / o < 0 ? -1 : 1, u.e = 0, u.d = [0];
            return;
          }
          if (o < 0 ? (o = -o, u.s = -1) : u.s = 1, o === ~~o && o < 1e7) {
            for (s = 0, a = o; a >= 10; a /= 10) s++;
            x ? s > i.maxE ? (u.e = NaN, u.d = null) : s < i.minE ? (u.e = 0, u.d = [0]) : (u.e = s, u.d = [o]) : (u.e = s, u.d = [o]);
            return;
          } else if (o * 0 !== 0) {
            o || (u.s = NaN), u.e = NaN, u.d = null;
            return;
          }
          return _i(u, o.toString());
        } else if (l !== "string") throw Error(Ke + o);
        return (a = o.charCodeAt(0)) === 45 ? (o = o.slice(1), u.s = -1) : (a === 43 && (o = o.slice(1)), u.s = 1), Os.test(o) ? _i(u, o) : Rc(u, o);
      }
      if (i.prototype = m, i.ROUND_UP = 0, i.ROUND_DOWN = 1, i.ROUND_CEIL = 2, i.ROUND_FLOOR = 3, i.ROUND_HALF_UP = 4, i.ROUND_HALF_DOWN = 5, i.ROUND_HALF_EVEN = 6, i.ROUND_HALF_CEIL = 7, i.ROUND_HALF_FLOOR = 8, i.EUCLID = 9, i.config = i.set = qc, i.clone = Ns, i.isDecimal = Rs, i.abs = Sc, i.acos = Ac, i.acosh = Ic, i.add = Oc, i.asin = kc, i.asinh = Dc, i.atan = _c, i.atanh = Fc, i.atan2 = Lc, i.cbrt = Nc, i.ceil = Mc, i.clamp = $c, i.cos = jc, i.cosh = Vc, i.div = Bc, i.exp = Uc, i.floor = Gc, i.hypot = Qc, i.ln = Jc, i.log = Wc, i.log10 = Kc, i.log2 = Hc, i.max = zc, i.min = Yc, i.mod = Zc, i.mul = Xc, i.pow = ep, i.random = tp, i.round = rp, i.sign = np, i.sin = ip, i.sinh = op, i.sqrt = sp, i.sub = ap, i.sum = lp, i.tan = up, i.tanh = cp, i.trunc = pp, e === void 0 && (e = {}), e && e.defaults !== true) for (n = ["precision", "rounding", "toExpNeg", "toExpPos", "maxE", "minE", "modulo", "crypto"], t = 0; t < n.length; ) e.hasOwnProperty(r = n[t++]) || (e[r] = this[r]);
      return i.config(e), i;
    }
    function Bc(e, t) {
      return new this(e).div(t);
    }
    function Uc(e) {
      return new this(e).exp();
    }
    function Gc(e) {
      return y(e = new this(e), e.e + 1, 3);
    }
    function Qc() {
      var e, t, r = new this(0);
      for (x = false, e = 0; e < arguments.length; ) if (t = new this(arguments[e++]), t.d) r.d && (r = r.plus(t.times(t)));
      else {
        if (t.s) return x = true, new this(1 / 0);
        r = t;
      }
      return x = true, r.sqrt();
    }
    function Rs(e) {
      return e instanceof ot || e && e.toStringTag === Is || false;
    }
    function Jc(e) {
      return new this(e).ln();
    }
    function Wc(e, t) {
      return new this(e).log(t);
    }
    function Hc(e) {
      return new this(e).log(2);
    }
    function Kc(e) {
      return new this(e).log(10);
    }
    function zc() {
      return _s(this, arguments, "lt");
    }
    function Yc() {
      return _s(this, arguments, "gt");
    }
    function Zc(e, t) {
      return new this(e).mod(t);
    }
    function Xc(e, t) {
      return new this(e).mul(t);
    }
    function ep(e, t) {
      return new this(e).pow(t);
    }
    function tp(e) {
      var t, r, n, i, o = 0, s = new this(1), a = [];
      if (e === void 0 ? e = this.precision : oe(e, 1, ze), n = Math.ceil(e / b), this.crypto) if (crypto.getRandomValues) for (t = crypto.getRandomValues(new Uint32Array(n)); o < n; ) i = t[o], i >= 429e7 ? t[o] = crypto.getRandomValues(new Uint32Array(1))[0] : a[o++] = i % 1e7;
      else if (crypto.randomBytes) {
        for (t = crypto.randomBytes(n *= 4); o < n; ) i = t[o] + (t[o + 1] << 8) + (t[o + 2] << 16) + ((t[o + 3] & 127) << 24), i >= 214e7 ? crypto.randomBytes(4).copy(t, o) : (a.push(i % 1e7), o += 4);
        o = n / 4;
      } else throw Error(As);
      else for (; o < n; ) a[o++] = Math.random() * 1e7 | 0;
      for (n = a[--o], e %= b, n && e && (i = G(10, b - e), a[o] = (n / i | 0) * i); a[o] === 0; o--) a.pop();
      if (o < 0) r = 0, a = [0];
      else {
        for (r = -1; a[0] === 0; r -= b) a.shift();
        for (n = 1, i = a[0]; i >= 10; i /= 10) n++;
        n < b && (r -= b - n);
      }
      return s.e = r, s.d = a, s;
    }
    function rp(e) {
      return y(e = new this(e), e.e + 1, this.rounding);
    }
    function np(e) {
      return e = new this(e), e.d ? e.d[0] ? e.s : 0 * e.s : e.s || NaN;
    }
    function ip(e) {
      return new this(e).sin();
    }
    function op(e) {
      return new this(e).sinh();
    }
    function sp(e) {
      return new this(e).sqrt();
    }
    function ap(e, t) {
      return new this(e).sub(t);
    }
    function lp() {
      var e = 0, t = arguments, r = new this(t[e]);
      for (x = false; r.s && ++e < t.length; ) r = r.plus(t[e]);
      return x = true, y(r, this.precision, this.rounding);
    }
    function up(e) {
      return new this(e).tan();
    }
    function cp(e) {
      return new this(e).tanh();
    }
    function pp(e) {
      return y(e = new this(e), e.e + 1, 1);
    }
    m[Symbol.for("nodejs.util.inspect.custom")] = m.toString;
    m[Symbol.toStringTag] = "Decimal";
    var ot = m.constructor = Ns(Oi);
    an = new ot(an);
    ln = new ot(ln);
    var Re = ot;
    function Rt(e) {
      return ot.isDecimal(e) ? true : e !== null && typeof e == "object" && typeof e.s == "number" && typeof e.e == "number" && typeof e.toFixed == "function" && Array.isArray(e.d);
    }
    var cr = class {
      constructor(t, r, n, i, o) {
        this.modelName = t, this.name = r, this.typeName = n, this.isList = i, this.isEnum = o;
      }
      _toGraphQLInputType() {
        let t = this.isList ? "List" : "", r = this.isEnum ? "Enum" : "";
        return `${t}${r}${this.typeName}FieldRefInput<${this.modelName}>`;
      }
    };
    function Ct(e) {
      return e instanceof cr;
    }
    var mn = class {
      constructor(t) {
        this.value = t;
      }
      write(t) {
        t.write(this.value);
      }
      markAsError() {
        this.value.markAsError();
      }
    };
    var fn = (e) => e;
    var gn = { bold: fn, red: fn, green: fn, dim: fn, enabled: false };
    var Ms = { bold: H, red: ce, green: qe, dim: Oe, enabled: true };
    var St = { write(e) {
      e.writeLine(",");
    } };
    var Ce = class {
      constructor(t) {
        this.contents = t;
        this.isUnderlined = false;
        this.color = (t2) => t2;
      }
      underline() {
        return this.isUnderlined = true, this;
      }
      setColor(t) {
        return this.color = t, this;
      }
      write(t) {
        let r = t.getCurrentLineLength();
        t.write(this.color(this.contents)), this.isUnderlined && t.afterNextNewline(() => {
          t.write(" ".repeat(r)).writeLine(this.color("~".repeat(this.contents.length)));
        });
      }
    };
    var Ye = class {
      constructor() {
        this.hasError = false;
      }
      markAsError() {
        return this.hasError = true, this;
      }
    };
    var At = class extends Ye {
      constructor() {
        super(...arguments);
        this.items = [];
      }
      addItem(r) {
        return this.items.push(new mn(r)), this;
      }
      getField(r) {
        return this.items[r];
      }
      getPrintWidth() {
        return this.items.length === 0 ? 2 : Math.max(...this.items.map((n) => n.value.getPrintWidth())) + 2;
      }
      write(r) {
        if (this.items.length === 0) {
          this.writeEmpty(r);
          return;
        }
        this.writeWithItems(r);
      }
      writeEmpty(r) {
        let n = new Ce("[]");
        this.hasError && n.setColor(r.context.colors.red).underline(), r.write(n);
      }
      writeWithItems(r) {
        let { colors: n } = r.context;
        r.writeLine("[").withIndent(() => r.writeJoined(St, this.items).newLine()).write("]"), this.hasError && r.afterNextNewline(() => {
          r.writeLine(n.red("~".repeat(this.getPrintWidth())));
        });
      }
      asObject() {
      }
    };
    var $s = ": ";
    var hn = class {
      constructor(t, r) {
        this.name = t;
        this.value = r;
        this.hasError = false;
      }
      markAsError() {
        this.hasError = true;
      }
      getPrintWidth() {
        return this.name.length + this.value.getPrintWidth() + $s.length;
      }
      write(t) {
        let r = new Ce(this.name);
        this.hasError && r.underline().setColor(t.context.colors.red), t.write(r).write($s).write(this.value);
      }
    };
    var It = class e extends Ye {
      constructor() {
        super(...arguments);
        this.fields = {};
        this.suggestions = [];
      }
      addField(r) {
        this.fields[r.name] = r;
      }
      addSuggestion(r) {
        this.suggestions.push(r);
      }
      getField(r) {
        return this.fields[r];
      }
      getDeepField(r) {
        let [n, ...i] = r, o = this.getField(n);
        if (!o) return;
        let s = o;
        for (let a of i) {
          let l;
          if (s.value instanceof e ? l = s.value.getField(a) : s.value instanceof At && (l = s.value.getField(Number(a))), !l) return;
          s = l;
        }
        return s;
      }
      getDeepFieldValue(r) {
        var _a7;
        return r.length === 0 ? this : (_a7 = this.getDeepField(r)) == null ? void 0 : _a7.value;
      }
      hasField(r) {
        return !!this.getField(r);
      }
      removeAllFields() {
        this.fields = {};
      }
      removeField(r) {
        delete this.fields[r];
      }
      getFields() {
        return this.fields;
      }
      isEmpty() {
        return Object.keys(this.fields).length === 0;
      }
      getFieldValue(r) {
        var _a7;
        return (_a7 = this.getField(r)) == null ? void 0 : _a7.value;
      }
      getDeepSubSelectionValue(r) {
        let n = this;
        for (let i of r) {
          if (!(n instanceof e)) return;
          let o = n.getSubSelectionValue(i);
          if (!o) return;
          n = o;
        }
        return n;
      }
      getDeepSelectionParent(r) {
        let n = this.getSelectionParent();
        if (!n) return;
        let i = n;
        for (let o of r) {
          let s = i.value.getFieldValue(o);
          if (!s || !(s instanceof e)) return;
          let a = s.getSelectionParent();
          if (!a) return;
          i = a;
        }
        return i;
      }
      getSelectionParent() {
        var _a7, _b2;
        let r = (_a7 = this.getField("select")) == null ? void 0 : _a7.value.asObject();
        if (r) return { kind: "select", value: r };
        let n = (_b2 = this.getField("include")) == null ? void 0 : _b2.value.asObject();
        if (n) return { kind: "include", value: n };
      }
      getSubSelectionValue(r) {
        var _a7;
        return (_a7 = this.getSelectionParent()) == null ? void 0 : _a7.value.fields[r].value;
      }
      getPrintWidth() {
        let r = Object.values(this.fields);
        return r.length == 0 ? 2 : Math.max(...r.map((i) => i.getPrintWidth())) + 2;
      }
      write(r) {
        let n = Object.values(this.fields);
        if (n.length === 0 && this.suggestions.length === 0) {
          this.writeEmpty(r);
          return;
        }
        this.writeWithContents(r, n);
      }
      asObject() {
        return this;
      }
      writeEmpty(r) {
        let n = new Ce("{}");
        this.hasError && n.setColor(r.context.colors.red).underline(), r.write(n);
      }
      writeWithContents(r, n) {
        r.writeLine("{").withIndent(() => {
          r.writeJoined(St, [...n, ...this.suggestions]).newLine();
        }), r.write("}"), this.hasError && r.afterNextNewline(() => {
          r.writeLine(r.context.colors.red("~".repeat(this.getPrintWidth())));
        });
      }
    };
    var W = class extends Ye {
      constructor(r) {
        super();
        this.text = r;
      }
      getPrintWidth() {
        return this.text.length;
      }
      write(r) {
        let n = new Ce(this.text);
        this.hasError && n.underline().setColor(r.context.colors.red), r.write(n);
      }
      asObject() {
      }
    };
    var Li = class {
      constructor(t) {
        this.errorMessages = [];
        this.arguments = t;
      }
      write(t) {
        t.write(this.arguments);
      }
      addErrorMessage(t) {
        this.errorMessages.push(t);
      }
      renderAllMessages(t) {
        return this.errorMessages.map((r) => r(t)).join(`
`);
      }
    };
    function Ot(e) {
      return new Li(qs(e));
    }
    function qs(e) {
      let t = new It();
      for (let [r, n] of Object.entries(e)) {
        let i = new hn(r, js(n));
        t.addField(i);
      }
      return t;
    }
    function js(e) {
      if (typeof e == "string") return new W(JSON.stringify(e));
      if (typeof e == "number" || typeof e == "boolean") return new W(String(e));
      if (typeof e == "bigint") return new W(`${e}n`);
      if (e === null) return new W("null");
      if (e === void 0) return new W("undefined");
      if (Rt(e)) return new W(`new Prisma.Decimal("${e.toFixed()}")`);
      if (e instanceof Uint8Array) return Buffer.isBuffer(e) ? new W(`Buffer.alloc(${e.byteLength})`) : new W(`new Uint8Array(${e.byteLength})`);
      if (e instanceof Date) {
        let t = on(e) ? e.toISOString() : "Invalid Date";
        return new W(`new Date("${t}")`);
      }
      return e instanceof Ne ? new W(`Prisma.${e._getName()}`) : Ct(e) ? new W(`prisma.${Ps(e.modelName)}.$fields.${e.name}`) : Array.isArray(e) ? mp(e) : typeof e == "object" ? qs(e) : new W(Object.prototype.toString.call(e));
    }
    function mp(e) {
      let t = new At();
      for (let r of e) t.addItem(js(r));
      return t;
    }
    function yn(e, t) {
      let r = t === "pretty" ? Ms : gn, n = e.renderAllMessages(r), i = new xt(0, { colors: r }).write(e).toString();
      return { message: n, args: i };
    }
    function Vs(e) {
      if (e === void 0) return "";
      let t = Ot(e);
      return new xt(0, { colors: gn }).write(t).toString();
    }
    var fp = "P2037";
    function st({ error: e, user_facing_error: t }, r, n) {
      return t.error_code ? new V(gp(t, n), { code: t.error_code, clientVersion: r, meta: t.meta, batchRequestIdx: t.batch_request_idx }) : new B(e, { clientVersion: r, batchRequestIdx: t.batch_request_idx });
    }
    function gp(e, t) {
      let r = e.message;
      return (t === "postgresql" || t === "postgres" || t === "mysql") && e.error_code === fp && (r += `
Prisma Accelerate has built-in connection pooling to prevent such errors: https://pris.ly/client/error-accelerate`), r;
    }
    var pr = "<unknown>";
    function Bs(e) {
      var t = e.split(`
`);
      return t.reduce(function(r, n) {
        var i = bp(n) || wp(n) || vp(n) || Sp(n) || Rp(n);
        return i && r.push(i), r;
      }, []);
    }
    var hp = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/|[a-z]:\\|\\\\).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
    var yp = /\((\S*)(?::(\d+))(?::(\d+))\)/;
    function bp(e) {
      var t = hp.exec(e);
      if (!t) return null;
      var r = t[2] && t[2].indexOf("native") === 0, n = t[2] && t[2].indexOf("eval") === 0, i = yp.exec(t[2]);
      return n && i != null && (t[2] = i[1], t[3] = i[2], t[4] = i[3]), { file: r ? null : t[2], methodName: t[1] || pr, arguments: r ? [t[2]] : [], lineNumber: t[3] ? +t[3] : null, column: t[4] ? +t[4] : null };
    }
    var Ep = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i;
    function wp(e) {
      var t = Ep.exec(e);
      return t ? { file: t[2], methodName: t[1] || pr, arguments: [], lineNumber: +t[3], column: t[4] ? +t[4] : null } : null;
    }
    var xp = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
    var Pp = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;
    function vp(e) {
      var t = xp.exec(e);
      if (!t) return null;
      var r = t[3] && t[3].indexOf(" > eval") > -1, n = Pp.exec(t[3]);
      return r && n != null && (t[3] = n[1], t[4] = n[2], t[5] = null), { file: t[3], methodName: t[1] || pr, arguments: t[2] ? t[2].split(",") : [], lineNumber: t[4] ? +t[4] : null, column: t[5] ? +t[5] : null };
    }
    var Tp = /^\s*(?:([^@]*)(?:\((.*?)\))?@)?(\S.*?):(\d+)(?::(\d+))?\s*$/i;
    function Rp(e) {
      var t = Tp.exec(e);
      return t ? { file: t[3], methodName: t[1] || pr, arguments: [], lineNumber: +t[4], column: t[5] ? +t[5] : null } : null;
    }
    var Cp = /^\s*at (?:((?:\[object object\])?[^\\/]+(?: \[as \S+\])?) )?\(?(.*?):(\d+)(?::(\d+))?\)?\s*$/i;
    function Sp(e) {
      var t = Cp.exec(e);
      return t ? { file: t[2], methodName: t[1] || pr, arguments: [], lineNumber: +t[3], column: t[4] ? +t[4] : null } : null;
    }
    var Ni = class {
      getLocation() {
        return null;
      }
    };
    var Mi = class {
      constructor() {
        this._error = new Error();
      }
      getLocation() {
        let t = this._error.stack;
        if (!t) return null;
        let n = Bs(t).find((i) => {
          if (!i.file) return false;
          let o = di(i.file);
          return o !== "<anonymous>" && !o.includes("@prisma") && !o.includes("/packages/client/src/runtime/") && !o.endsWith("/runtime/binary.js") && !o.endsWith("/runtime/library.js") && !o.endsWith("/runtime/edge.js") && !o.endsWith("/runtime/edge-esm.js") && !o.startsWith("internal/") && !i.methodName.includes("new ") && !i.methodName.includes("getCallSite") && !i.methodName.includes("Proxy.") && i.methodName.split(".").length < 4;
        });
        return !n || !n.file ? null : { fileName: n.file, lineNumber: n.lineNumber, columnNumber: n.column };
      }
    };
    function Ze(e) {
      return e === "minimal" ? typeof $EnabledCallSite == "function" && e !== "minimal" ? new $EnabledCallSite() : new Ni() : new Mi();
    }
    var Us = { _avg: true, _count: true, _sum: true, _min: true, _max: true };
    function kt(e = {}) {
      let t = Ip(e);
      return Object.entries(t).reduce((n, [i, o]) => (Us[i] !== void 0 ? n.select[i] = { select: o } : n[i] = o, n), { select: {} });
    }
    function Ip(e = {}) {
      return typeof e._count == "boolean" ? __spreadProps(__spreadValues({}, e), { _count: { _all: e._count } }) : e;
    }
    function bn(e = {}) {
      return (t) => (typeof e._count == "boolean" && (t._count = t._count._all), t);
    }
    function Gs(e, t) {
      let r = bn(e);
      return t({ action: "aggregate", unpacker: r, argsMapper: kt })(e);
    }
    function Op(e = {}) {
      let _a7 = e, { select: t } = _a7, r = __objRest(_a7, ["select"]);
      return typeof t == "object" ? kt(__spreadProps(__spreadValues({}, r), { _count: t })) : kt(__spreadProps(__spreadValues({}, r), { _count: { _all: true } }));
    }
    function kp(e = {}) {
      return typeof e.select == "object" ? (t) => bn(e)(t)._count : (t) => bn(e)(t)._count._all;
    }
    function Qs(e, t) {
      return t({ action: "count", unpacker: kp(e), argsMapper: Op })(e);
    }
    function Dp(e = {}) {
      let t = kt(e);
      if (Array.isArray(t.by)) for (let r of t.by) typeof r == "string" && (t.select[r] = true);
      else typeof t.by == "string" && (t.select[t.by] = true);
      return t;
    }
    function _p(e = {}) {
      return (t) => (typeof (e == null ? void 0 : e._count) == "boolean" && t.forEach((r) => {
        r._count = r._count._all;
      }), t);
    }
    function Js(e, t) {
      return t({ action: "groupBy", unpacker: _p(e), argsMapper: Dp })(e);
    }
    function Ws(e, t, r) {
      if (t === "aggregate") return (n) => Gs(n, r);
      if (t === "count") return (n) => Qs(n, r);
      if (t === "groupBy") return (n) => Js(n, r);
    }
    function Hs(e, t) {
      let r = t.fields.filter((i) => !i.relationName), n = Ei(r, (i) => i.name);
      return new Proxy({}, __spreadValues({ get(i, o) {
        if (o in i || typeof o == "symbol") return i[o];
        let s = n[o];
        if (s) return new cr(e, o, s.type, s.isList, s.kind === "enum");
      } }, nn(Object.keys(n))));
    }
    var Ks = (e) => Array.isArray(e) ? e : e.split(".");
    var $i = (e, t) => Ks(t).reduce((r, n) => r && r[n], e);
    var zs = (e, t, r) => Ks(t).reduceRight((n, i, o, s) => Object.assign({}, $i(e, s.slice(0, o)), { [i]: n }), r);
    function Fp(e, t) {
      return e === void 0 || t === void 0 ? [] : [...t, "select", e];
    }
    function Lp(e, t, r) {
      return t === void 0 ? e != null ? e : {} : zs(t, r, e || true);
    }
    function qi(e, t, r, n, i, o) {
      let a = e._runtimeDataModel.models[t].fields.reduce((l, u) => __spreadProps(__spreadValues({}, l), { [u.name]: u }), {});
      return (l) => {
        let u = Ze(e._errorFormat), c = Fp(n, i), p = Lp(l, o, c), d = r({ dataPath: c, callsite: u })(p), f = Np(e, t);
        return new Proxy(d, __spreadValues({ get(g, h) {
          if (!f.includes(h)) return g[h];
          let T = [a[h].type, r, h], S = [c, p];
          return qi(e, ...T, ...S);
        } }, nn([...f, ...Object.getOwnPropertyNames(d)])));
      };
    }
    function Np(e, t) {
      return e._runtimeDataModel.models[t].fields.filter((r) => r.kind === "object").map((r) => r.name);
    }
    var ra = k(mi());
    var ta = k(require("fs"));
    var Ys = { keyword: De, entity: De, value: (e) => H(rt(e)), punctuation: rt, directive: De, function: De, variable: (e) => H(rt(e)), string: (e) => H(qe(e)), boolean: ke, number: De, comment: Bt };
    var Mp = (e) => e;
    var En = {};
    var $p = 0;
    var P = { manual: En.Prism && En.Prism.manual, disableWorkerMessageHandler: En.Prism && En.Prism.disableWorkerMessageHandler, util: { encode: function(e) {
      if (e instanceof he) {
        let t = e;
        return new he(t.type, P.util.encode(t.content), t.alias);
      } else return Array.isArray(e) ? e.map(P.util.encode) : e.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u00a0/g, " ");
    }, type: function(e) {
      return Object.prototype.toString.call(e).slice(8, -1);
    }, objId: function(e) {
      return e.__id || Object.defineProperty(e, "__id", { value: ++$p }), e.__id;
    }, clone: function e(t, r) {
      let n, i, o = P.util.type(t);
      switch (r = r || {}, o) {
        case "Object":
          if (i = P.util.objId(t), r[i]) return r[i];
          n = {}, r[i] = n;
          for (let s in t) t.hasOwnProperty(s) && (n[s] = e(t[s], r));
          return n;
        case "Array":
          return i = P.util.objId(t), r[i] ? r[i] : (n = [], r[i] = n, t.forEach(function(s, a) {
            n[a] = e(s, r);
          }), n);
        default:
          return t;
      }
    } }, languages: { extend: function(e, t) {
      let r = P.util.clone(P.languages[e]);
      for (let n in t) r[n] = t[n];
      return r;
    }, insertBefore: function(e, t, r, n) {
      n = n || P.languages;
      let i = n[e], o = {};
      for (let a in i) if (i.hasOwnProperty(a)) {
        if (a == t) for (let l in r) r.hasOwnProperty(l) && (o[l] = r[l]);
        r.hasOwnProperty(a) || (o[a] = i[a]);
      }
      let s = n[e];
      return n[e] = o, P.languages.DFS(P.languages, function(a, l) {
        l === s && a != e && (this[a] = o);
      }), o;
    }, DFS: function e(t, r, n, i) {
      i = i || {};
      let o = P.util.objId;
      for (let s in t) if (t.hasOwnProperty(s)) {
        r.call(t, s, t[s], n || s);
        let a = t[s], l = P.util.type(a);
        l === "Object" && !i[o(a)] ? (i[o(a)] = true, e(a, r, null, i)) : l === "Array" && !i[o(a)] && (i[o(a)] = true, e(a, r, s, i));
      }
    } }, plugins: {}, highlight: function(e, t, r) {
      let n = { code: e, grammar: t, language: r };
      return P.hooks.run("before-tokenize", n), n.tokens = P.tokenize(n.code, n.grammar), P.hooks.run("after-tokenize", n), he.stringify(P.util.encode(n.tokens), n.language);
    }, matchGrammar: function(e, t, r, n, i, o, s) {
      for (let h in r) {
        if (!r.hasOwnProperty(h) || !r[h]) continue;
        if (h == s) return;
        let O = r[h];
        O = P.util.type(O) === "Array" ? O : [O];
        for (let T = 0; T < O.length; ++T) {
          let S = O[T], C = S.inside, E = !!S.lookbehind, me = !!S.greedy, ae = 0, jt = S.alias;
          if (me && !S.pattern.global) {
            let U = S.pattern.toString().match(/[imuy]*$/)[0];
            S.pattern = RegExp(S.pattern.source, U + "g");
          }
          S = S.pattern || S;
          for (let U = n, ne = i; U < t.length; ne += t[U].length, ++U) {
            let Ie = t[U];
            if (t.length > e.length) return;
            if (Ie instanceof he) continue;
            if (me && U != t.length - 1) {
              S.lastIndex = ne;
              var p = S.exec(e);
              if (!p) break;
              var c = p.index + (E ? p[1].length : 0), d = p.index + p[0].length, a = U, l = ne;
              for (let _ = t.length; a < _ && (l < d || !t[a].type && !t[a - 1].greedy); ++a) l += t[a].length, c >= l && (++U, ne = l);
              if (t[U] instanceof he) continue;
              u = a - U, Ie = e.slice(ne, l), p.index -= ne;
            } else {
              S.lastIndex = 0;
              var p = S.exec(Ie), u = 1;
            }
            if (!p) {
              if (o) break;
              continue;
            }
            E && (ae = p[1] ? p[1].length : 0);
            var c = p.index + ae, p = p[0].slice(ae), d = c + p.length, f = Ie.slice(0, c), g = Ie.slice(d);
            let z = [U, u];
            f && (++U, ne += f.length, z.push(f));
            let dt = new he(h, C ? P.tokenize(p, C) : p, jt, p, me);
            if (z.push(dt), g && z.push(g), Array.prototype.splice.apply(t, z), u != 1 && P.matchGrammar(e, t, r, U, ne, true, h), o) break;
          }
        }
      }
    }, tokenize: function(e, t) {
      let r = [e], n = t.rest;
      if (n) {
        for (let i in n) t[i] = n[i];
        delete t.rest;
      }
      return P.matchGrammar(e, r, t, 0, 0, false), r;
    }, hooks: { all: {}, add: function(e, t) {
      let r = P.hooks.all;
      r[e] = r[e] || [], r[e].push(t);
    }, run: function(e, t) {
      let r = P.hooks.all[e];
      if (!(!r || !r.length)) for (var n = 0, i; i = r[n++]; ) i(t);
    } }, Token: he };
    P.languages.clike = { comment: [{ pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/, lookbehind: true }, { pattern: /(^|[^\\:])\/\/.*/, lookbehind: true, greedy: true }], string: { pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/, greedy: true }, "class-name": { pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i, lookbehind: true, inside: { punctuation: /[.\\]/ } }, keyword: /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/, boolean: /\b(?:true|false)\b/, function: /\w+(?=\()/, number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i, operator: /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/, punctuation: /[{}[\];(),.:]/ };
    P.languages.javascript = P.languages.extend("clike", { "class-name": [P.languages.clike["class-name"], { pattern: /(^|[^$\w\xA0-\uFFFF])[_$A-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\.(?:prototype|constructor))/, lookbehind: true }], keyword: [{ pattern: /((?:^|})\s*)(?:catch|finally)\b/, lookbehind: true }, { pattern: /(^|[^.])\b(?:as|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/, lookbehind: true }], number: /\b(?:(?:0[xX](?:[\dA-Fa-f](?:_[\dA-Fa-f])?)+|0[bB](?:[01](?:_[01])?)+|0[oO](?:[0-7](?:_[0-7])?)+)n?|(?:\d(?:_\d)?)+n|NaN|Infinity)\b|(?:\b(?:\d(?:_\d)?)+\.?(?:\d(?:_\d)?)*|\B\.(?:\d(?:_\d)?)+)(?:[Ee][+-]?(?:\d(?:_\d)?)+)?/, function: /[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/, operator: /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/ });
    P.languages.javascript["class-name"][0].pattern = /(\b(?:class|interface|extends|implements|instanceof|new)\s+)[\w.\\]+/;
    P.languages.insertBefore("javascript", "keyword", { regex: { pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s])\s*)\/(\[(?:[^\]\\\r\n]|\\.)*]|\\.|[^/\\\[\r\n])+\/[gimyus]{0,6}(?=\s*($|[\r\n,.;})\]]))/, lookbehind: true, greedy: true }, "function-variable": { pattern: /[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|[_$a-zA-Z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/, alias: "function" }, parameter: [{ pattern: /(function(?:\s+[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)?\s*\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\))/, lookbehind: true, inside: P.languages.javascript }, { pattern: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=>)/i, inside: P.languages.javascript }, { pattern: /(\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*=>)/, lookbehind: true, inside: P.languages.javascript }, { pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:[_$A-Za-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*\s*)\(\s*)(?!\s)(?:[^()]|\([^()]*\))+?(?=\s*\)\s*\{)/, lookbehind: true, inside: P.languages.javascript }], constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/ });
    P.languages.markup && P.languages.markup.tag.addInlined("script", "javascript");
    P.languages.js = P.languages.javascript;
    P.languages.typescript = P.languages.extend("javascript", { keyword: /\b(?:abstract|as|async|await|break|case|catch|class|const|constructor|continue|debugger|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|is|keyof|let|module|namespace|new|null|of|package|private|protected|public|readonly|return|require|set|static|super|switch|this|throw|try|type|typeof|var|void|while|with|yield)\b/, builtin: /\b(?:string|Function|any|number|boolean|Array|symbol|console|Promise|unknown|never)\b/ });
    P.languages.ts = P.languages.typescript;
    function he(e, t, r, n, i) {
      this.type = e, this.content = t, this.alias = r, this.length = (n || "").length | 0, this.greedy = !!i;
    }
    he.stringify = function(e, t) {
      return typeof e == "string" ? e : Array.isArray(e) ? e.map(function(r) {
        return he.stringify(r, t);
      }).join("") : qp(e.type)(e.content);
    };
    function qp(e) {
      return Ys[e] || Mp;
    }
    function Zs(e) {
      return jp(e, P.languages.javascript);
    }
    function jp(e, t) {
      return P.tokenize(e, t).map((n) => he.stringify(n)).join("");
    }
    var Xs = k(ss());
    function ea(e) {
      return (0, Xs.default)(e);
    }
    var wn = class e {
      static read(t) {
        let r;
        try {
          r = ta.default.readFileSync(t, "utf-8");
        } catch (e2) {
          return null;
        }
        return e.fromContent(r);
      }
      static fromContent(t) {
        let r = t.split(/\r?\n/);
        return new e(1, r);
      }
      constructor(t, r) {
        this.firstLineNumber = t, this.lines = r;
      }
      get lastLineNumber() {
        return this.firstLineNumber + this.lines.length - 1;
      }
      mapLineAt(t, r) {
        if (t < this.firstLineNumber || t > this.lines.length + this.firstLineNumber) return this;
        let n = t - this.firstLineNumber, i = [...this.lines];
        return i[n] = r(i[n]), new e(this.firstLineNumber, i);
      }
      mapLines(t) {
        return new e(this.firstLineNumber, this.lines.map((r, n) => t(r, this.firstLineNumber + n)));
      }
      lineAt(t) {
        return this.lines[t - this.firstLineNumber];
      }
      prependSymbolAt(t, r) {
        return this.mapLines((n, i) => i === t ? `${r} ${n}` : `  ${n}`);
      }
      slice(t, r) {
        let n = this.lines.slice(t - 1, r).join(`
`);
        return new e(t, ea(n).split(`
`));
      }
      highlight() {
        let t = Zs(this.toString());
        return new e(this.firstLineNumber, t.split(`
`));
      }
      toString() {
        return this.lines.join(`
`);
      }
    };
    var Vp = { red: ce, gray: Bt, dim: Oe, bold: H, underline: X, highlightSource: (e) => e.highlight() };
    var Bp = { red: (e) => e, gray: (e) => e, dim: (e) => e, bold: (e) => e, underline: (e) => e, highlightSource: (e) => e };
    function Up({ message: e, originalMethod: t, isPanic: r, callArguments: n }) {
      return { functionName: `prisma.${t}()`, message: e, isPanic: r != null ? r : false, callArguments: n };
    }
    function Gp({ callsite: e, message: t, originalMethod: r, isPanic: n, callArguments: i }, o) {
      var _a7;
      let s = Up({ message: t, originalMethod: r, isPanic: n, callArguments: i });
      if (!e || typeof window < "u" || process.env.NODE_ENV === "production") return s;
      let a = e.getLocation();
      if (!a || !a.lineNumber || !a.columnNumber) return s;
      let l = Math.max(1, a.lineNumber - 3), u = (_a7 = wn.read(a.fileName)) == null ? void 0 : _a7.slice(l, a.lineNumber), c = u == null ? void 0 : u.lineAt(a.lineNumber);
      if (u && c) {
        let p = Jp(c), d = Qp(c);
        if (!d) return s;
        s.functionName = `${d.code})`, s.location = a, n || (u = u.mapLineAt(a.lineNumber, (g) => g.slice(0, d.openingBraceIndex))), u = o.highlightSource(u);
        let f = String(u.lastLineNumber).length;
        if (s.contextLines = u.mapLines((g, h) => o.gray(String(h).padStart(f)) + " " + g).mapLines((g) => o.dim(g)).prependSymbolAt(a.lineNumber, o.bold(o.red("\u2192"))), i) {
          let g = p + f + 1;
          g += 2, s.callArguments = (0, ra.default)(i, g).slice(g);
        }
      }
      return s;
    }
    function Qp(e) {
      let t = Object.keys(Je.ModelAction).join("|"), n = new RegExp(String.raw`\.(${t})\(`).exec(e);
      if (n) {
        let i = n.index + n[0].length, o = e.lastIndexOf(" ", n.index) + 1;
        return { code: e.slice(o, i), openingBraceIndex: i };
      }
      return null;
    }
    function Jp(e) {
      let t = 0;
      for (let r = 0; r < e.length; r++) {
        if (e.charAt(r) !== " ") return t;
        t++;
      }
      return t;
    }
    function Wp({ functionName: e, location: t, message: r, isPanic: n, contextLines: i, callArguments: o }, s) {
      let a = [""], l = t ? " in" : ":";
      if (n ? (a.push(s.red(`Oops, an unknown error occurred! This is ${s.bold("on us")}, you did nothing wrong.`)), a.push(s.red(`It occurred in the ${s.bold(`\`${e}\``)} invocation${l}`))) : a.push(s.red(`Invalid ${s.bold(`\`${e}\``)} invocation${l}`)), t && a.push(s.underline(Hp(t))), i) {
        a.push("");
        let u = [i.toString()];
        o && (u.push(o), u.push(s.dim(")"))), a.push(u.join("")), o && a.push("");
      } else a.push(""), o && a.push(o), a.push("");
      return a.push(r), a.join(`
`);
    }
    function Hp(e) {
      let t = [e.fileName];
      return e.lineNumber && t.push(String(e.lineNumber)), e.columnNumber && t.push(String(e.columnNumber)), t.join(":");
    }
    function Dt(e) {
      let t = e.showColors ? Vp : Bp, r;
      return r = Gp(e, t), Wp(r, t);
    }
    function na(e, t, r, n) {
      return e === Je.ModelAction.findFirstOrThrow || e === Je.ModelAction.findUniqueOrThrow ? Kp(t, r, n) : n;
    }
    function Kp(e, t, r) {
      return (n) => __async(this, null, function* () {
        if ("rejectOnNotFound" in n.args) {
          let o = Dt({ originalMethod: n.clientMethod, callsite: n.callsite, message: "'rejectOnNotFound' option is not supported" });
          throw new J(o, { clientVersion: t });
        }
        return yield r(n).catch((o) => {
          throw o instanceof V && o.code === "P2025" ? new Le(`No ${e} found`, t) : o;
        });
      });
    }
    function Se(e) {
      return e.replace(/^./, (t) => t.toLowerCase());
    }
    var zp = ["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "create", "update", "upsert", "delete"];
    var Yp = ["aggregate", "count", "groupBy"];
    function ji(e, t) {
      var _a7;
      let r = (_a7 = e._extensions.getAllModelExtensions(t)) != null ? _a7 : {}, n = [Zp(e, t), ed(e, t), lr(r), re("name", () => t), re("$name", () => t), re("$parent", () => e._appliedParent)];
      return ve({}, n);
    }
    function Zp(e, t) {
      let r = Se(t), n = Object.keys(Je.ModelAction).concat("count");
      return { getKeys() {
        return n;
      }, getPropertyValue(i) {
        let o = i, s = (l) => e._request(l);
        s = na(o, t, e._clientVersion, s);
        let a = (l) => (u) => {
          let c = Ze(e._errorFormat);
          return e._createPrismaPromise((p) => {
            let d = { args: u, dataPath: [], action: o, model: t, clientMethod: `${r}.${i}`, jsModelName: r, transaction: p, callsite: c };
            return s(__spreadValues(__spreadValues({}, d), l));
          });
        };
        return zp.includes(o) ? qi(e, t, a) : Xp(i) ? Ws(e, i, a) : a({});
      } };
    }
    function Xp(e) {
      return Yp.includes(e);
    }
    function ed(e, t) {
      return it(re("fields", () => {
        let r = e._runtimeDataModel.models[t];
        return Hs(t, r);
      }));
    }
    function ia(e) {
      return e.replace(/^./, (t) => t.toUpperCase());
    }
    var Vi = Symbol();
    function dr(e) {
      let t = [td(e), re(Vi, () => e), re("$parent", () => e._appliedParent)], r = e._extensions.getAllClientExtensions();
      return r && t.push(lr(r)), ve(e, t);
    }
    function td(e) {
      let t = Object.keys(e._runtimeDataModel.models), r = t.map(Se), n = [...new Set(t.concat(r))];
      return it({ getKeys() {
        return n;
      }, getPropertyValue(i) {
        let o = ia(i);
        if (e._runtimeDataModel.models[o] !== void 0) return ji(e, o);
        if (e._runtimeDataModel.models[i] !== void 0) return ji(e, i);
      }, getPropertyDescriptor(i) {
        if (!r.includes(i)) return { enumerable: false };
      } });
    }
    function oa(e) {
      return e[Vi] ? e[Vi] : e;
    }
    function sa(e) {
      var _a7;
      if (typeof e == "function") return e(this);
      if ((_a7 = e.client) == null ? void 0 : _a7.__AccelerateEngine) {
        let r = e.client.__AccelerateEngine;
        this._originalClient._engine = new r(this._originalClient._accelerateEngineConfig);
      }
      let t = Object.create(this._originalClient, { _extensions: { value: this._extensions.append(e) }, _appliedParent: { value: this, configurable: true }, $use: { value: void 0 }, $on: { value: void 0 } });
      return dr(t);
    }
    function aa({ result: e, modelName: t, select: r, omit: n, extensions: i }) {
      let o = i.getAllComputedFields(t);
      if (!o) return e;
      let s = [], a = [];
      for (let l of Object.values(o)) {
        if (n) {
          if (n[l.name]) continue;
          let u = l.needs.filter((c) => n[c]);
          u.length > 0 && a.push(Et(u));
        } else if (r) {
          if (!r[l.name]) continue;
          let u = l.needs.filter((c) => !r[c]);
          u.length > 0 && a.push(Et(u));
        }
        rd(e, l.needs) && s.push(nd(l, ve(e, s)));
      }
      return s.length > 0 || a.length > 0 ? ve(e, [...s, ...a]) : e;
    }
    function rd(e, t) {
      return t.every((r) => bi(e, r));
    }
    function nd(e, t) {
      return it(re(e.name, () => e.compute(t)));
    }
    function xn({ visitor: e, result: t, args: r, runtimeDataModel: n, modelName: i }) {
      var _a7;
      if (Array.isArray(t)) {
        for (let s = 0; s < t.length; s++) t[s] = xn({ result: t[s], args: r, modelName: i, runtimeDataModel: n, visitor: e });
        return t;
      }
      let o = (_a7 = e(t, i, r)) != null ? _a7 : t;
      return r.include && la({ includeOrSelect: r.include, result: o, parentModelName: i, runtimeDataModel: n, visitor: e }), r.select && la({ includeOrSelect: r.select, result: o, parentModelName: i, runtimeDataModel: n, visitor: e }), o;
    }
    function la({ includeOrSelect: e, result: t, parentModelName: r, runtimeDataModel: n, visitor: i }) {
      for (let [o, s] of Object.entries(e)) {
        if (!s || t[o] == null || we(s)) continue;
        let l = n.models[r].fields.find((c) => c.name === o);
        if (!l || l.kind !== "object" || !l.relationName) continue;
        let u = typeof s == "object" ? s : {};
        t[o] = xn({ visitor: i, result: t[o], args: u, modelName: l.type, runtimeDataModel: n });
      }
    }
    function ua({ result: e, modelName: t, args: r, extensions: n, runtimeDataModel: i, globalOmit: o }) {
      return n.isEmpty() || e == null || typeof e != "object" || !i.models[t] ? e : xn({ result: e, args: r != null ? r : {}, modelName: t, runtimeDataModel: i, visitor: (a, l, u) => {
        let c = Se(l);
        return aa({ result: a, modelName: c, select: u.select, omit: u.select ? void 0 : __spreadValues(__spreadValues({}, o == null ? void 0 : o[c]), u.omit), extensions: n });
      } });
    }
    function ca(e) {
      if (e instanceof ie) return id(e);
      if (Array.isArray(e)) {
        let r = [e[0]];
        for (let n = 1; n < e.length; n++) r[n] = mr(e[n]);
        return r;
      }
      let t = {};
      for (let r in e) t[r] = mr(e[r]);
      return t;
    }
    function id(e) {
      return new ie(e.strings, e.values);
    }
    function mr(e) {
      if (typeof e != "object" || e == null || e instanceof Ne || Ct(e)) return e;
      if (Rt(e)) return new Re(e.toFixed());
      if (Pt(e)) return /* @__PURE__ */ new Date(+e);
      if (ArrayBuffer.isView(e)) return e.slice(0);
      if (Array.isArray(e)) {
        let t = e.length, r;
        for (r = Array(t); t--; ) r[t] = mr(e[t]);
        return r;
      }
      if (typeof e == "object") {
        let t = {};
        for (let r in e) r === "__proto__" ? Object.defineProperty(t, r, { value: mr(e[r]), configurable: true, enumerable: true, writable: true }) : t[r] = mr(e[r]);
        return t;
      }
      Fe(e, "Unknown value");
    }
    function da(e, t, r, n = 0) {
      return e._createPrismaPromise((i) => {
        var _a7, _b2;
        let o = t.customDataProxyFetch;
        return "transaction" in t && i !== void 0 && (((_a7 = t.transaction) == null ? void 0 : _a7.kind) === "batch" && t.transaction.lock.then(), t.transaction = i), n === r.length ? e._executeRequest(t) : r[n]({ model: t.model, operation: t.model ? t.action : t.clientMethod, args: ca((_b2 = t.args) != null ? _b2 : {}), __internalParams: t, query: (s, a = t) => {
          let l = a.customDataProxyFetch;
          return a.customDataProxyFetch = ha(o, l), a.args = s, da(e, a, r, n + 1);
        } });
      });
    }
    function ma(e, t) {
      let { jsModelName: r, action: n, clientMethod: i } = t, o = r ? n : i;
      if (e._extensions.isEmpty()) return e._executeRequest(t);
      let s = e._extensions.getAllQueryCallbacks(r != null ? r : "$none", o);
      return da(e, t, s);
    }
    function fa(e) {
      return (t) => {
        let r = { requests: t }, n = t[0].extensions.getAllBatchQueryCallbacks();
        return n.length ? ga(r, n, 0, e) : e(r);
      };
    }
    function ga(e, t, r, n) {
      if (r === t.length) return n(e);
      let i = e.customDataProxyFetch, o = e.requests[0].transaction;
      return t[r]({ args: { queries: e.requests.map((s) => ({ model: s.modelName, operation: s.action, args: s.args })), transaction: o ? { isolationLevel: o.kind === "batch" ? o.isolationLevel : void 0 } : void 0 }, __internalParams: e, query(s, a = e) {
        let l = a.customDataProxyFetch;
        return a.customDataProxyFetch = ha(i, l), ga(a, t, r + 1, n);
      } });
    }
    var pa = (e) => e;
    function ha(e = pa, t = pa) {
      return (r) => e(t(r));
    }
    function ba(e, t, r) {
      let n = Se(r);
      return !t.result || !(t.result.$allModels || t.result[n]) ? e : od(__spreadValues(__spreadValues(__spreadValues({}, e), ya(t.name, e, t.result.$allModels)), ya(t.name, e, t.result[n])));
    }
    function od(e) {
      let t = new Pe(), r = (n, i) => t.getOrCreate(n, () => i.has(n) ? [n] : (i.add(n), e[n] ? e[n].needs.flatMap((o) => r(o, i)) : [n]));
      return yt(e, (n) => __spreadProps(__spreadValues({}, n), { needs: r(n.name, /* @__PURE__ */ new Set()) }));
    }
    function ya(e, t, r) {
      return r ? yt(r, ({ needs: n, compute: i }, o) => ({ name: o, needs: n ? Object.keys(n).filter((s) => n[s]) : [], compute: sd(t, o, i) })) : {};
    }
    function sd(e, t, r) {
      var _a7;
      let n = (_a7 = e == null ? void 0 : e[t]) == null ? void 0 : _a7.compute;
      return n ? (i) => r(__spreadProps(__spreadValues({}, i), { [t]: n(i) })) : r;
    }
    function Ea(e, t) {
      if (!t) return e;
      let r = __spreadValues({}, e);
      for (let n of Object.values(t)) if (e[n.name]) for (let i of n.needs) r[i] = true;
      return r;
    }
    function wa(e, t) {
      if (!t) return e;
      let r = __spreadValues({}, e);
      for (let n of Object.values(t)) if (!e[n.name]) for (let i of n.needs) delete r[i];
      return r;
    }
    var Pn = class {
      constructor(t, r) {
        this.extension = t;
        this.previous = r;
        this.computedFieldsCache = new Pe();
        this.modelExtensionsCache = new Pe();
        this.queryCallbacksCache = new Pe();
        this.clientExtensions = er(() => {
          var _a7, _b2;
          return this.extension.client ? __spreadValues(__spreadValues({}, (_a7 = this.previous) == null ? void 0 : _a7.getAllClientExtensions()), this.extension.client) : (_b2 = this.previous) == null ? void 0 : _b2.getAllClientExtensions();
        });
        this.batchCallbacks = er(() => {
          var _a7, _b2, _c2;
          let t2 = (_b2 = (_a7 = this.previous) == null ? void 0 : _a7.getAllBatchQueryCallbacks()) != null ? _b2 : [], r2 = (_c2 = this.extension.query) == null ? void 0 : _c2.$__internalBatch;
          return r2 ? t2.concat(r2) : t2;
        });
      }
      getAllComputedFields(t) {
        return this.computedFieldsCache.getOrCreate(t, () => {
          var _a7;
          return ba((_a7 = this.previous) == null ? void 0 : _a7.getAllComputedFields(t), this.extension, t);
        });
      }
      getAllClientExtensions() {
        return this.clientExtensions.get();
      }
      getAllModelExtensions(t) {
        return this.modelExtensionsCache.getOrCreate(t, () => {
          var _a7, _b2;
          let r = Se(t);
          return !this.extension.model || !(this.extension.model[r] || this.extension.model.$allModels) ? (_a7 = this.previous) == null ? void 0 : _a7.getAllModelExtensions(t) : __spreadValues(__spreadValues(__spreadValues({}, (_b2 = this.previous) == null ? void 0 : _b2.getAllModelExtensions(t)), this.extension.model.$allModels), this.extension.model[r]);
        });
      }
      getAllQueryCallbacks(t, r) {
        return this.queryCallbacksCache.getOrCreate(`${t}:${r}`, () => {
          var _a7, _b2;
          let n = (_b2 = (_a7 = this.previous) == null ? void 0 : _a7.getAllQueryCallbacks(t, r)) != null ? _b2 : [], i = [], o = this.extension.query;
          return !o || !(o[t] || o.$allModels || o[r] || o.$allOperations) ? n : (o[t] !== void 0 && (o[t][r] !== void 0 && i.push(o[t][r]), o[t].$allOperations !== void 0 && i.push(o[t].$allOperations)), t !== "$none" && o.$allModels !== void 0 && (o.$allModels[r] !== void 0 && i.push(o.$allModels[r]), o.$allModels.$allOperations !== void 0 && i.push(o.$allModels.$allOperations)), o[r] !== void 0 && i.push(o[r]), o.$allOperations !== void 0 && i.push(o.$allOperations), n.concat(i));
        });
      }
      getAllBatchQueryCallbacks() {
        return this.batchCallbacks.get();
      }
    };
    var vn = class e {
      constructor(t) {
        this.head = t;
      }
      static empty() {
        return new e();
      }
      static single(t) {
        return new e(new Pn(t));
      }
      isEmpty() {
        return this.head === void 0;
      }
      append(t) {
        return new e(new Pn(t, this.head));
      }
      getAllComputedFields(t) {
        var _a7;
        return (_a7 = this.head) == null ? void 0 : _a7.getAllComputedFields(t);
      }
      getAllClientExtensions() {
        var _a7;
        return (_a7 = this.head) == null ? void 0 : _a7.getAllClientExtensions();
      }
      getAllModelExtensions(t) {
        var _a7;
        return (_a7 = this.head) == null ? void 0 : _a7.getAllModelExtensions(t);
      }
      getAllQueryCallbacks(t, r) {
        var _a7, _b2;
        return (_b2 = (_a7 = this.head) == null ? void 0 : _a7.getAllQueryCallbacks(t, r)) != null ? _b2 : [];
      }
      getAllBatchQueryCallbacks() {
        var _a7, _b2;
        return (_b2 = (_a7 = this.head) == null ? void 0 : _a7.getAllBatchQueryCallbacks()) != null ? _b2 : [];
      }
    };
    var xa = L("prisma:client");
    var Pa = { Vercel: "vercel", "Netlify CI": "netlify" };
    function va({ postinstall: e, ciName: t, clientVersion: r }) {
      if (xa("checkPlatformCaching:postinstall", e), xa("checkPlatformCaching:ciName", t), e === true && t && t in Pa) {
        let n = `Prisma has detected that this project was built on ${t}, which caches dependencies. This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered. To fix this, make sure to run the \`prisma generate\` command during the build process.

Learn how: https://pris.ly/d/${Pa[t]}-build`;
        throw console.error(n), new R(n, r);
      }
    }
    function Ta(e, t) {
      return e ? e.datasources ? e.datasources : e.datasourceUrl ? { [t[0]]: { url: e.datasourceUrl } } : {} : {};
    }
    var ad = "Cloudflare-Workers";
    var ld = "node";
    function Ra() {
      var _a7, _b2, _c2;
      return typeof Netlify == "object" ? "netlify" : typeof EdgeRuntime == "string" ? "edge-light" : ((_a7 = globalThis.navigator) == null ? void 0 : _a7.userAgent) === ad ? "workerd" : globalThis.Deno ? "deno" : globalThis.__lagon__ ? "lagon" : ((_c2 = (_b2 = globalThis.process) == null ? void 0 : _b2.release) == null ? void 0 : _c2.name) === ld ? "node" : globalThis.Bun ? "bun" : globalThis.fastly ? "fastly" : "unknown";
    }
    var ud = { node: "Node.js", workerd: "Cloudflare Workers", deno: "Deno and Deno Deploy", netlify: "Netlify Edge Functions", "edge-light": "Edge Runtime (Vercel Edge Functions, Vercel Edge Middleware, Next.js (Pages Router) Edge API Routes, Next.js (App Router) Edge Route Handlers or Next.js Middleware)" };
    function Tn() {
      let e = Ra();
      return { id: e, prettyName: ud[e] || e, isEdge: ["workerd", "deno", "netlify", "edge-light"].includes(e) };
    }
    var Oa = k(require("fs"));
    var fr = k(require("path"));
    function Rn(e) {
      let { runtimeBinaryTarget: t } = e;
      return `Add "${t}" to \`binaryTargets\` in the "schema.prisma" file and run \`prisma generate\` after saving it:

${cd(e)}`;
    }
    function cd(e) {
      let { generator: t, generatorBinaryTargets: r, runtimeBinaryTarget: n } = e, i = { fromEnvVar: null, value: n }, o = [...r, i];
      return gi(__spreadProps(__spreadValues({}, t), { binaryTargets: o }));
    }
    function Xe(e) {
      let { runtimeBinaryTarget: t } = e;
      return `Prisma Client could not locate the Query Engine for runtime "${t}".`;
    }
    function et(e) {
      let { searchedLocations: t } = e;
      return `The following locations have been searched:
${[...new Set(t)].map((i) => `  ${i}`).join(`
`)}`;
    }
    function Ca(e) {
      let { runtimeBinaryTarget: t } = e;
      return `${Xe(e)}

This happened because \`binaryTargets\` have been pinned, but the actual deployment also required "${t}".
${Rn(e)}

${et(e)}`;
    }
    function Cn(e) {
      return `We would appreciate if you could take the time to share some information with us.
Please help us by answering a few questions: https://pris.ly/${e}`;
    }
    function Sn(e) {
      let { errorStack: t } = e;
      return (t == null ? void 0 : t.match(/\/\.next|\/next@|\/next\//)) ? `

We detected that you are using Next.js, learn how to fix this: https://pris.ly/d/engine-not-found-nextjs.` : "";
    }
    function Sa(e) {
      let { queryEngineName: t } = e;
      return `${Xe(e)}${Sn(e)}

This is likely caused by a bundler that has not copied "${t}" next to the resulting bundle.
Ensure that "${t}" has been copied next to the bundle or in "${e.expectedLocation}".

${Cn("engine-not-found-bundler-investigation")}

${et(e)}`;
    }
    function Aa(e) {
      var _a7;
      let { runtimeBinaryTarget: t, generatorBinaryTargets: r } = e, n = r.find((i) => i.native);
      return `${Xe(e)}

This happened because Prisma Client was generated for "${(_a7 = n == null ? void 0 : n.value) != null ? _a7 : "unknown"}", but the actual deployment required "${t}".
${Rn(e)}

${et(e)}`;
    }
    function Ia(e) {
      let { queryEngineName: t } = e;
      return `${Xe(e)}${Sn(e)}

This is likely caused by tooling that has not copied "${t}" to the deployment folder.
Ensure that you ran \`prisma generate\` and that "${t}" has been copied to "${e.expectedLocation}".

${Cn("engine-not-found-tooling-investigation")}

${et(e)}`;
    }
    var pd = L("prisma:client:engines:resolveEnginePath");
    var dd = () => new RegExp("runtime[\\\\/]library\\.m?js$");
    function ka(e, t) {
      return __async(this, null, function* () {
        var _a7, _b2, _c2;
        let r = (_a7 = { binary: process.env.PRISMA_QUERY_ENGINE_BINARY, library: process.env.PRISMA_QUERY_ENGINE_LIBRARY }[e]) != null ? _a7 : t.prismaPath;
        if (r !== void 0) return r;
        let { enginePath: n, searchedLocations: i } = yield md(e, t);
        if (pd("enginePath", n), n !== void 0 && e === "binary" && ai(n), n !== void 0) return t.prismaPath = n;
        let o = yield nt(), s = (_c2 = (_b2 = t.generator) == null ? void 0 : _b2.binaryTargets) != null ? _c2 : [], a = s.some((d) => d.native), l = !s.some((d) => d.value === o), u = __filename.match(dd()) === null, c = { searchedLocations: i, generatorBinaryTargets: s, generator: t.generator, runtimeBinaryTarget: o, queryEngineName: Da(e, o), expectedLocation: fr.default.relative(process.cwd(), t.dirname), errorStack: new Error().stack }, p;
        throw a && l ? p = Aa(c) : l ? p = Ca(c) : u ? p = Sa(c) : p = Ia(c), new R(p, t.clientVersion);
      });
    }
    function md(engineType, config) {
      return __async(this, null, function* () {
        var _a7, _b2, _c2;
        let binaryTarget = yield nt(), searchedLocations = [], dirname = eval("__dirname"), searchLocations = [config.dirname, fr.default.resolve(dirname, ".."), (_c2 = (_b2 = (_a7 = config.generator) == null ? void 0 : _a7.output) == null ? void 0 : _b2.value) != null ? _c2 : dirname, fr.default.resolve(dirname, "../../../.prisma/client"), "/tmp/prisma-engines", config.cwd];
        __filename.includes("resolveEnginePath") && searchLocations.push(Ho());
        for (let e of searchLocations) {
          let t = Da(engineType, binaryTarget), r = fr.default.join(e, t);
          if (searchedLocations.push(e), Oa.default.existsSync(r)) return { enginePath: r, searchedLocations };
        }
        return { enginePath: void 0, searchedLocations };
      });
    }
    function Da(e, t) {
      return e === "library" ? $r(t, "fs") : `query-engine-${t}${t === "windows" ? ".exe" : ""}`;
    }
    var Bi = k(yi());
    function _a(e) {
      return e ? e.replace(/".*"/g, '"X"').replace(/[\s:\[]([+-]?([0-9]*[.])?[0-9]+)/g, (t) => `${t[0]}5`) : "";
    }
    function Fa(e) {
      return e.split(`
`).map((t) => t.replace(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)\s*/, "").replace(/\+\d+\s*ms$/, "")).join(`
`);
    }
    var La = k(ms());
    function Na({ title: e, user: t = "prisma", repo: r = "prisma", template: n = "bug_report.yml", body: i }) {
      return (0, La.default)({ user: t, repo: r, template: n, title: e, body: i });
    }
    function Ma({ version: e, binaryTarget: t, title: r, description: n, engineVersion: i, database: o, query: s }) {
      var _a7, _b2;
      let a = To(6e3 - ((_a7 = s == null ? void 0 : s.length) != null ? _a7 : 0)), l = Fa((0, Bi.default)(a)), u = n ? `# Description
\`\`\`
${n}
\`\`\`` : "", c = (0, Bi.default)(`Hi Prisma Team! My Prisma Client just crashed. This is the report:
## Versions

| Name            | Version            |
|-----------------|--------------------|
| Node            | ${(_b2 = process.version) == null ? void 0 : _b2.padEnd(19)}| 
| OS              | ${t == null ? void 0 : t.padEnd(19)}|
| Prisma Client   | ${e == null ? void 0 : e.padEnd(19)}|
| Query Engine    | ${i == null ? void 0 : i.padEnd(19)}|
| Database        | ${o == null ? void 0 : o.padEnd(19)}|

${u}

## Logs
\`\`\`
${l}
\`\`\`

## Client Snippet
\`\`\`ts
// PLEASE FILL YOUR CODE SNIPPET HERE
\`\`\`

## Schema
\`\`\`prisma
// PLEASE ADD YOUR SCHEMA HERE IF POSSIBLE
\`\`\`

## Prisma Engine Query
\`\`\`
${s ? _a(s) : ""}
\`\`\`
`), p = Na({ title: r, body: c });
      return `${r}

This is a non-recoverable error which probably happens when the Prisma Query Engine has a panic.

${X(p)}

If you want the Prisma team to look into it, please open the link above \u{1F64F}
To increase the chance of success, please post your schema and a snippet of
how you used Prisma Client in the issue. 
`;
    }
    function _t({ inlineDatasources: e, overrideDatasources: t, env: r, clientVersion: n }) {
      var _a7, _b2;
      let i, o = Object.keys(e)[0], s = (_a7 = e[o]) == null ? void 0 : _a7.url, a = (_b2 = t[o]) == null ? void 0 : _b2.url;
      if (o === void 0 ? i = void 0 : a ? i = a : (s == null ? void 0 : s.value) ? i = s.value : (s == null ? void 0 : s.fromEnvVar) && (i = r[s.fromEnvVar]), (s == null ? void 0 : s.fromEnvVar) !== void 0 && i === void 0) throw new R(`error: Environment variable not found: ${s.fromEnvVar}.`, n);
      if (i === void 0) throw new R("error: Missing URL environment variable, value, or override.", n);
      return i;
    }
    var An = class extends Error {
      constructor(t, r) {
        super(t), this.clientVersion = r.clientVersion, this.cause = r.cause;
      }
      get [Symbol.toStringTag]() {
        return this.name;
      }
    };
    var se = class extends An {
      constructor(t, r) {
        var _a7;
        super(t, r), this.isRetryable = (_a7 = r.isRetryable) != null ? _a7 : true;
      }
    };
    function A(e, t) {
      return __spreadProps(__spreadValues({}, e), { isRetryable: t });
    }
    var Ft = class extends se {
      constructor(r) {
        super("This request must be retried", A(r, true));
        this.name = "ForcedRetryError";
        this.code = "P5001";
      }
    };
    w(Ft, "ForcedRetryError");
    var at = class extends se {
      constructor(r, n) {
        super(r, A(n, false));
        this.name = "InvalidDatasourceError";
        this.code = "P6001";
      }
    };
    w(at, "InvalidDatasourceError");
    var lt = class extends se {
      constructor(r, n) {
        super(r, A(n, false));
        this.name = "NotImplementedYetError";
        this.code = "P5004";
      }
    };
    w(lt, "NotImplementedYetError");
    var q = class extends se {
      constructor(t, r) {
        super(t, r), this.response = r.response;
        let n = this.response.headers.get("prisma-request-id");
        if (n) {
          let i = `(The request id was: ${n})`;
          this.message = this.message + " " + i;
        }
      }
    };
    var ut = class extends q {
      constructor(r) {
        super("Schema needs to be uploaded", A(r, true));
        this.name = "SchemaMissingError";
        this.code = "P5005";
      }
    };
    w(ut, "SchemaMissingError");
    var Ui = "This request could not be understood by the server";
    var gr = class extends q {
      constructor(r, n, i) {
        super(n || Ui, A(r, false));
        this.name = "BadRequestError";
        this.code = "P5000";
        i && (this.code = i);
      }
    };
    w(gr, "BadRequestError");
    var hr = class extends q {
      constructor(r, n) {
        super("Engine not started: healthcheck timeout", A(r, true));
        this.name = "HealthcheckTimeoutError";
        this.code = "P5013";
        this.logs = n;
      }
    };
    w(hr, "HealthcheckTimeoutError");
    var yr = class extends q {
      constructor(r, n, i) {
        super(n, A(r, true));
        this.name = "EngineStartupError";
        this.code = "P5014";
        this.logs = i;
      }
    };
    w(yr, "EngineStartupError");
    var br = class extends q {
      constructor(r) {
        super("Engine version is not supported", A(r, false));
        this.name = "EngineVersionNotSupportedError";
        this.code = "P5012";
      }
    };
    w(br, "EngineVersionNotSupportedError");
    var Gi = "Request timed out";
    var Er = class extends q {
      constructor(r, n = Gi) {
        super(n, A(r, false));
        this.name = "GatewayTimeoutError";
        this.code = "P5009";
      }
    };
    w(Er, "GatewayTimeoutError");
    var fd = "Interactive transaction error";
    var wr = class extends q {
      constructor(r, n = fd) {
        super(n, A(r, false));
        this.name = "InteractiveTransactionError";
        this.code = "P5015";
      }
    };
    w(wr, "InteractiveTransactionError");
    var gd = "Request parameters are invalid";
    var xr = class extends q {
      constructor(r, n = gd) {
        super(n, A(r, false));
        this.name = "InvalidRequestError";
        this.code = "P5011";
      }
    };
    w(xr, "InvalidRequestError");
    var Qi = "Requested resource does not exist";
    var Pr = class extends q {
      constructor(r, n = Qi) {
        super(n, A(r, false));
        this.name = "NotFoundError";
        this.code = "P5003";
      }
    };
    w(Pr, "NotFoundError");
    var Ji = "Unknown server error";
    var Lt = class extends q {
      constructor(r, n, i) {
        super(n || Ji, A(r, true));
        this.name = "ServerError";
        this.code = "P5006";
        this.logs = i;
      }
    };
    w(Lt, "ServerError");
    var Wi = "Unauthorized, check your connection string";
    var vr = class extends q {
      constructor(r, n = Wi) {
        super(n, A(r, false));
        this.name = "UnauthorizedError";
        this.code = "P5007";
      }
    };
    w(vr, "UnauthorizedError");
    var Hi = "Usage exceeded, retry again later";
    var Tr = class extends q {
      constructor(r, n = Hi) {
        super(n, A(r, true));
        this.name = "UsageExceededError";
        this.code = "P5008";
      }
    };
    w(Tr, "UsageExceededError");
    function hd(e) {
      return __async(this, null, function* () {
        let t;
        try {
          t = yield e.text();
        } catch (e2) {
          return { type: "EmptyError" };
        }
        try {
          let r = JSON.parse(t);
          if (typeof r == "string") switch (r) {
            case "InternalDataProxyError":
              return { type: "DataProxyError", body: r };
            default:
              return { type: "UnknownTextError", body: r };
          }
          if (typeof r == "object" && r !== null) {
            if ("is_panic" in r && "message" in r && "error_code" in r) return { type: "QueryEngineError", body: r };
            if ("EngineNotStarted" in r || "InteractiveTransactionMisrouted" in r || "InvalidRequestError" in r) {
              let n = Object.values(r)[0].reason;
              return typeof n == "string" && !["SchemaMissing", "EngineVersionNotSupported"].includes(n) ? { type: "UnknownJsonError", body: r } : { type: "DataProxyError", body: r };
            }
          }
          return { type: "UnknownJsonError", body: r };
        } catch (e2) {
          return t === "" ? { type: "EmptyError" } : { type: "UnknownTextError", body: t };
        }
      });
    }
    function Rr(e, t) {
      return __async(this, null, function* () {
        if (e.ok) return;
        let r = { clientVersion: t, response: e }, n = yield hd(e);
        if (n.type === "QueryEngineError") throw new V(n.body.message, { code: n.body.error_code, clientVersion: t });
        if (n.type === "DataProxyError") {
          if (n.body === "InternalDataProxyError") throw new Lt(r, "Internal Data Proxy error");
          if ("EngineNotStarted" in n.body) {
            if (n.body.EngineNotStarted.reason === "SchemaMissing") return new ut(r);
            if (n.body.EngineNotStarted.reason === "EngineVersionNotSupported") throw new br(r);
            if ("EngineStartupError" in n.body.EngineNotStarted.reason) {
              let { msg: i, logs: o } = n.body.EngineNotStarted.reason.EngineStartupError;
              throw new yr(r, i, o);
            }
            if ("KnownEngineStartupError" in n.body.EngineNotStarted.reason) {
              let { msg: i, error_code: o } = n.body.EngineNotStarted.reason.KnownEngineStartupError;
              throw new R(i, t, o);
            }
            if ("HealthcheckTimeout" in n.body.EngineNotStarted.reason) {
              let { logs: i } = n.body.EngineNotStarted.reason.HealthcheckTimeout;
              throw new hr(r, i);
            }
          }
          if ("InteractiveTransactionMisrouted" in n.body) {
            let i = { IDParseError: "Could not parse interactive transaction ID", NoQueryEngineFoundError: "Could not find Query Engine for the specified host and transaction ID", TransactionStartError: "Could not start interactive transaction" };
            throw new wr(r, i[n.body.InteractiveTransactionMisrouted.reason]);
          }
          if ("InvalidRequestError" in n.body) throw new xr(r, n.body.InvalidRequestError.reason);
        }
        if (e.status === 401 || e.status === 403) throw new vr(r, Nt(Wi, n));
        if (e.status === 404) return new Pr(r, Nt(Qi, n));
        if (e.status === 429) throw new Tr(r, Nt(Hi, n));
        if (e.status === 504) throw new Er(r, Nt(Gi, n));
        if (e.status >= 500) throw new Lt(r, Nt(Ji, n));
        if (e.status >= 400) throw new gr(r, Nt(Ui, n));
      });
    }
    function Nt(e, t) {
      return t.type === "EmptyError" ? e : `${e}: ${JSON.stringify(t)}`;
    }
    function $a(e) {
      let t = Math.pow(2, e) * 50, r = Math.ceil(Math.random() * t) - Math.ceil(t / 2), n = t + r;
      return new Promise((i) => setTimeout(() => i(n), n));
    }
    var $e = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    function qa(e) {
      let t = new TextEncoder().encode(e), r = "", n = t.byteLength, i = n % 3, o = n - i, s, a, l, u, c;
      for (let p = 0; p < o; p = p + 3) c = t[p] << 16 | t[p + 1] << 8 | t[p + 2], s = (c & 16515072) >> 18, a = (c & 258048) >> 12, l = (c & 4032) >> 6, u = c & 63, r += $e[s] + $e[a] + $e[l] + $e[u];
      return i == 1 ? (c = t[o], s = (c & 252) >> 2, a = (c & 3) << 4, r += $e[s] + $e[a] + "==") : i == 2 && (c = t[o] << 8 | t[o + 1], s = (c & 64512) >> 10, a = (c & 1008) >> 4, l = (c & 15) << 2, r += $e[s] + $e[a] + $e[l] + "="), r;
    }
    function ja(e) {
      var _a7;
      if (!!((_a7 = e.generator) == null ? void 0 : _a7.previewFeatures.some((r) => r.toLowerCase().includes("metrics")))) throw new R("The `metrics` preview feature is not yet available with Accelerate.\nPlease remove `metrics` from the `previewFeatures` in your schema.\n\nMore information about Accelerate: https://pris.ly/d/accelerate", e.clientVersion);
    }
    function yd(e) {
      return e[0] * 1e3 + e[1] / 1e6;
    }
    function Va(e) {
      return new Date(yd(e));
    }
    var Ba = { "@prisma/debug": "workspace:*", "@prisma/engines-version": "5.21.0-36.08713a93b99d58f31485621c634b04983ae01d95", "@prisma/fetch-engine": "workspace:*", "@prisma/get-platform": "workspace:*" };
    var Cr = class extends se {
      constructor(r, n) {
        super(`Cannot fetch data from service:
${r}`, A(n, true));
        this.name = "RequestError";
        this.code = "P5010";
      }
    };
    w(Cr, "RequestError");
    function ct(e, t, r = (n) => n) {
      return __async(this, null, function* () {
        var _a7;
        let n = t.clientVersion;
        try {
          return typeof fetch == "function" ? yield r(fetch)(e, t) : yield r(Ki)(e, t);
        } catch (i) {
          let o = (_a7 = i.message) != null ? _a7 : "Unknown error";
          throw new Cr(o, { clientVersion: n });
        }
      });
    }
    function Ed(e) {
      return __spreadProps(__spreadValues({}, e.headers), { "Content-Type": "application/json" });
    }
    function wd(e) {
      return { method: e.method, headers: Ed(e) };
    }
    function xd(e, t) {
      return { text: () => Promise.resolve(Buffer.concat(e).toString()), json: () => Promise.resolve().then(() => JSON.parse(Buffer.concat(e).toString())), ok: t.statusCode >= 200 && t.statusCode <= 299, status: t.statusCode, url: t.url, headers: new zi(t.headers) };
    }
    function Ki(_0) {
      return __async(this, arguments, function* (e, t = {}) {
        let r = Pd("https"), n = wd(t), i = [], { origin: o } = new URL(e);
        return new Promise((s, a) => {
          var _a7;
          let l = r.request(e, n, (u) => {
            let { statusCode: c, headers: { location: p } } = u;
            c >= 301 && c <= 399 && p && (p.startsWith("http") === false ? s(Ki(`${o}${p}`, t)) : s(Ki(p, t))), u.on("data", (d) => i.push(d)), u.on("end", () => s(xd(i, u))), u.on("error", a);
          });
          l.on("error", a), l.end((_a7 = t.body) != null ? _a7 : "");
        });
      });
    }
    var Pd = typeof require < "u" ? require : () => {
    };
    var zi = class {
      constructor(t = {}) {
        this.headers = /* @__PURE__ */ new Map();
        for (let [r, n] of Object.entries(t)) if (typeof n == "string") this.headers.set(r, n);
        else if (Array.isArray(n)) for (let i of n) this.headers.set(r, i);
      }
      append(t, r) {
        this.headers.set(t, r);
      }
      delete(t) {
        this.headers.delete(t);
      }
      get(t) {
        var _a7;
        return (_a7 = this.headers.get(t)) != null ? _a7 : null;
      }
      has(t) {
        return this.headers.has(t);
      }
      set(t, r) {
        this.headers.set(t, r);
      }
      forEach(t, r) {
        for (let [n, i] of this.headers) t.call(r, i, n, this);
      }
    };
    var vd = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/;
    var Ua = L("prisma:client:dataproxyEngine");
    function Td(e, t) {
      return __async(this, null, function* () {
        var _a7, _b2, _c2;
        let r = Ba["@prisma/engines-version"], n = (_a7 = t.clientVersion) != null ? _a7 : "unknown";
        if (process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION) return process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION;
        if (e.includes("accelerate") && n !== "0.0.0" && n !== "in-memory") return n;
        let [i, o] = (_b2 = n == null ? void 0 : n.split("-")) != null ? _b2 : [];
        if (o === void 0 && vd.test(i)) return i;
        if (o !== void 0 || n === "0.0.0" || n === "in-memory") {
          if (e.startsWith("localhost") || e.startsWith("127.0.0.1")) return "0.0.0";
          let [s] = (_c2 = r.split("-")) != null ? _c2 : [], [a, l, u] = s.split("."), c = Rd(`<=${a}.${l}.${u}`), p = yield ct(c, { clientVersion: n });
          if (!p.ok) throw new Error(`Failed to fetch stable Prisma version, unpkg.com status ${p.status} ${p.statusText}, response body: ${(yield p.text()) || "<empty body>"}`);
          let d = yield p.text();
          Ua("length of body fetched from unpkg.com", d.length);
          let f;
          try {
            f = JSON.parse(d);
          } catch (g) {
            throw console.error("JSON.parse error: body fetched from unpkg.com: ", d), g;
          }
          return f.version;
        }
        throw new lt("Only `major.minor.patch` versions are supported by Accelerate.", { clientVersion: n });
      });
    }
    function Ga(e, t) {
      return __async(this, null, function* () {
        let r = yield Td(e, t);
        return Ua("version", r), r;
      });
    }
    function Rd(e) {
      return encodeURI(`https://unpkg.com/prisma@${e}/package.json`);
    }
    var Qa = 3;
    var Yi = L("prisma:client:dataproxyEngine");
    var Zi = class {
      constructor({ apiKey: t, tracingHelper: r, logLevel: n, logQueries: i, engineHash: o }) {
        this.apiKey = t, this.tracingHelper = r, this.logLevel = n, this.logQueries = i, this.engineHash = o;
      }
      build({ traceparent: t, interactiveTransaction: r } = {}) {
        let n = { Authorization: `Bearer ${this.apiKey}`, "Prisma-Engine-Hash": this.engineHash };
        this.tracingHelper.isEnabled() && (n.traceparent = t != null ? t : this.tracingHelper.getTraceParent()), r && (n["X-transaction-id"] = r.id);
        let i = this.buildCaptureSettings();
        return i.length > 0 && (n["X-capture-telemetry"] = i.join(", ")), n;
      }
      buildCaptureSettings() {
        let t = [];
        return this.tracingHelper.isEnabled() && t.push("tracing"), this.logLevel && t.push(this.logLevel), this.logQueries && t.push("query"), t;
      }
    };
    var Sr = class {
      constructor(t) {
        this.name = "DataProxyEngine";
        ja(t), this.config = t, this.env = __spreadValues(__spreadValues({}, t.env), typeof process < "u" ? process.env : {}), this.inlineSchema = qa(t.inlineSchema), this.inlineDatasources = t.inlineDatasources, this.inlineSchemaHash = t.inlineSchemaHash, this.clientVersion = t.clientVersion, this.engineHash = t.engineVersion, this.logEmitter = t.logEmitter, this.tracingHelper = t.tracingHelper;
      }
      apiKey() {
        return this.headerBuilder.apiKey;
      }
      version() {
        return this.engineHash;
      }
      start() {
        return __async(this, null, function* () {
          this.startPromise !== void 0 && (yield this.startPromise), this.startPromise = (() => __async(this, null, function* () {
            let [t, r] = this.extractHostAndApiKey();
            this.host = t, this.headerBuilder = new Zi({ apiKey: r, tracingHelper: this.tracingHelper, logLevel: this.config.logLevel, logQueries: this.config.logQueries, engineHash: this.engineHash }), this.remoteClientVersion = yield Ga(t, this.config), Yi("host", this.host);
          }))(), yield this.startPromise;
        });
      }
      stop() {
        return __async(this, null, function* () {
        });
      }
      propagateResponseExtensions(t) {
        var _a7, _b2;
        ((_a7 = t == null ? void 0 : t.logs) == null ? void 0 : _a7.length) && t.logs.forEach((r) => {
          switch (r.level) {
            case "debug":
            case "error":
            case "trace":
            case "warn":
            case "info":
              break;
            case "query": {
              let n = typeof r.attributes.query == "string" ? r.attributes.query : "";
              if (!this.tracingHelper.isEnabled()) {
                let [i] = n.split("/* traceparent");
                n = i;
              }
              this.logEmitter.emit("query", { query: n, timestamp: Va(r.timestamp), duration: Number(r.attributes.duration_ms), params: r.attributes.params, target: r.attributes.target });
            }
          }
        }), ((_b2 = t == null ? void 0 : t.traces) == null ? void 0 : _b2.length) && this.tracingHelper.createEngineSpan({ span: true, spans: t.traces });
      }
      onBeforeExit() {
        throw new Error('"beforeExit" hook is not applicable to the remote query engine');
      }
      url(t) {
        return __async(this, null, function* () {
          return yield this.start(), `https://${this.host}/${this.remoteClientVersion}/${this.inlineSchemaHash}/${t}`;
        });
      }
      uploadSchema() {
        return __async(this, null, function* () {
          let t = { name: "schemaUpload", internal: true };
          return this.tracingHelper.runInChildSpan(t, () => __async(this, null, function* () {
            let r = yield ct(yield this.url("schema"), { method: "PUT", headers: this.headerBuilder.build(), body: this.inlineSchema, clientVersion: this.clientVersion });
            r.ok || Yi("schema response status", r.status);
            let n = yield Rr(r, this.clientVersion);
            if (n) throw this.logEmitter.emit("warn", { message: `Error while uploading schema: ${n.message}`, timestamp: /* @__PURE__ */ new Date(), target: "" }), n;
            this.logEmitter.emit("info", { message: `Schema (re)uploaded (hash: ${this.inlineSchemaHash})`, timestamp: /* @__PURE__ */ new Date(), target: "" });
          }));
        });
      }
      request(t, { traceparent: r, interactiveTransaction: n, customDataProxyFetch: i }) {
        return this.requestInternal({ body: t, traceparent: r, interactiveTransaction: n, customDataProxyFetch: i });
      }
      requestBatch(_0, _1) {
        return __async(this, arguments, function* (t, { traceparent: r, transaction: n, customDataProxyFetch: i }) {
          let o = (n == null ? void 0 : n.kind) === "itx" ? n.options : void 0, s = wt(t, n), { batchResult: a, elapsed: l } = yield this.requestInternal({ body: s, customDataProxyFetch: i, interactiveTransaction: o, traceparent: r });
          return a.map((u) => "errors" in u && u.errors.length > 0 ? st(u.errors[0], this.clientVersion, this.config.activeProvider) : { data: u, elapsed: l });
        });
      }
      requestInternal({ body: t, traceparent: r, customDataProxyFetch: n, interactiveTransaction: i }) {
        return this.withRetry({ actionGerund: "querying", callback: (_0) => __async(this, [_0], function* ({ logHttpCall: o }) {
          let s = i ? `${i.payload.endpoint}/graphql` : yield this.url("graphql");
          o(s);
          let a = yield ct(s, { method: "POST", headers: this.headerBuilder.build({ traceparent: r, interactiveTransaction: i }), body: JSON.stringify(t), clientVersion: this.clientVersion }, n);
          a.ok || Yi("graphql response status", a.status), yield this.handleError(yield Rr(a, this.clientVersion));
          let l = yield a.json(), u = l.extensions;
          if (u && this.propagateResponseExtensions(u), l.errors) throw l.errors.length === 1 ? st(l.errors[0], this.config.clientVersion, this.config.activeProvider) : new B(l.errors, { clientVersion: this.config.clientVersion });
          return l;
        }) });
      }
      transaction(t, r, n) {
        return __async(this, null, function* () {
          let i = { start: "starting", commit: "committing", rollback: "rolling back" };
          return this.withRetry({ actionGerund: `${i[t]} transaction`, callback: (_0) => __async(this, [_0], function* ({ logHttpCall: o }) {
            if (t === "start") {
              let s = JSON.stringify({ max_wait: n.maxWait, timeout: n.timeout, isolation_level: n.isolationLevel }), a = yield this.url("transaction/start");
              o(a);
              let l = yield ct(a, { method: "POST", headers: this.headerBuilder.build({ traceparent: r.traceparent }), body: s, clientVersion: this.clientVersion });
              yield this.handleError(yield Rr(l, this.clientVersion));
              let u = yield l.json(), c = u.extensions;
              c && this.propagateResponseExtensions(c);
              let p = u.id, d = u["data-proxy"].endpoint;
              return { id: p, payload: { endpoint: d } };
            } else {
              let s = `${n.payload.endpoint}/${t}`;
              o(s);
              let a = yield ct(s, { method: "POST", headers: this.headerBuilder.build({ traceparent: r.traceparent }), clientVersion: this.clientVersion });
              yield this.handleError(yield Rr(a, this.clientVersion));
              let u = (yield a.json()).extensions;
              u && this.propagateResponseExtensions(u);
              return;
            }
          }) });
        });
      }
      extractHostAndApiKey() {
        let t = { clientVersion: this.clientVersion }, r = Object.keys(this.inlineDatasources)[0], n = _t({ inlineDatasources: this.inlineDatasources, overrideDatasources: this.config.overrideDatasources, clientVersion: this.clientVersion, env: this.env }), i;
        try {
          i = new URL(n);
        } catch (e) {
          throw new at(`Error validating datasource \`${r}\`: the URL must start with the protocol \`prisma://\``, t);
        }
        let { protocol: o, host: s, searchParams: a } = i;
        if (o !== "prisma:" && o !== "prisma+postgres:") throw new at(`Error validating datasource \`${r}\`: the URL must start with the protocol \`prisma://\``, t);
        let l = a.get("api_key");
        if (l === null || l.length < 1) throw new at(`Error validating datasource \`${r}\`: the URL must contain a valid API key`, t);
        return [s, l];
      }
      metrics() {
        throw new lt("Metrics are not yet supported for Accelerate", { clientVersion: this.clientVersion });
      }
      withRetry(t) {
        return __async(this, null, function* () {
          var _a7;
          for (let r = 0; ; r++) {
            let n = (i) => {
              this.logEmitter.emit("info", { message: `Calling ${i} (n=${r})`, timestamp: /* @__PURE__ */ new Date(), target: "" });
            };
            try {
              return yield t.callback({ logHttpCall: n });
            } catch (i) {
              if (!(i instanceof se) || !i.isRetryable) throw i;
              if (r >= Qa) throw i instanceof Ft ? i.cause : i;
              this.logEmitter.emit("warn", { message: `Attempt ${r + 1}/${Qa} failed for ${t.actionGerund}: ${(_a7 = i.message) != null ? _a7 : "(unknown)"}`, timestamp: /* @__PURE__ */ new Date(), target: "" });
              let o = yield $a(r);
              this.logEmitter.emit("warn", { message: `Retrying after ${o}ms`, timestamp: /* @__PURE__ */ new Date(), target: "" });
            }
          }
        });
      }
      handleError(t) {
        return __async(this, null, function* () {
          if (t instanceof ut) throw yield this.uploadSchema(), new Ft({ clientVersion: this.clientVersion, cause: t });
          if (t) throw t;
        });
      }
      applyPendingMigrations() {
        throw new Error("Method not implemented.");
      }
    };
    function Ja(e) {
      if ((e == null ? void 0 : e.kind) === "itx") return e.options.id;
    }
    var eo = k(require("os"));
    var Wa = k(require("path"));
    var Xi = Symbol("PrismaLibraryEngineCache");
    function Cd() {
      let e = globalThis;
      return e[Xi] === void 0 && (e[Xi] = {}), e[Xi];
    }
    function Sd(e) {
      let t = Cd();
      if (t[e] !== void 0) return t[e];
      let r = Wa.default.toNamespacedPath(e), n = { exports: {} }, i = 0;
      return process.platform !== "win32" && (i = eo.default.constants.dlopen.RTLD_LAZY | eo.default.constants.dlopen.RTLD_DEEPBIND), process.dlopen(n, r, i), t[e] = n.exports, n.exports;
    }
    var Ha = { loadLibrary(e) {
      return __async(this, null, function* () {
        let t = yield zn(), r = yield ka("library", e);
        try {
          return e.tracingHelper.runInChildSpan({ name: "loadLibrary", internal: true }, () => Sd(r));
        } catch (n) {
          let i = li({ e: n, platformInfo: t, id: r });
          throw new R(i, e.clientVersion);
        }
      });
    } };
    var to;
    var Ka = { loadLibrary(e) {
      return __async(this, null, function* () {
        let { clientVersion: t, adapter: r, engineWasm: n } = e;
        if (r === void 0) throw new R(`The \`adapter\` option for \`PrismaClient\` is required in this context (${Tn().prettyName})`, t);
        if (n === void 0) throw new R("WASM engine was unexpectedly `undefined`", t);
        to === void 0 && (to = (() => __async(this, null, function* () {
          let o = n.getRuntime(), s = yield n.getQueryEngineWasmModule();
          if (s == null) throw new R("The loaded wasm module was unexpectedly `undefined` or `null` once loaded", t);
          let a = { "./query_engine_bg.js": o }, l = new WebAssembly.Instance(s, a);
          return o.__wbg_set_wasm(l.exports), o.QueryEngine;
        }))());
        let i = yield to;
        return { debugPanic() {
          return Promise.reject("{}");
        }, dmmf() {
          return Promise.resolve("{}");
        }, version() {
          return { commit: "unknown", version: "unknown" };
        }, QueryEngine: i };
      });
    } };
    var Ad = "P2036";
    var Ae = L("prisma:client:libraryEngine");
    function Id(e) {
      return e.item_type === "query" && "query" in e;
    }
    function Od(e) {
      return "level" in e ? e.level === "error" && e.message === "PANIC" : false;
    }
    var za = [...Qn, "native"];
    var Ar = class {
      constructor(t, r) {
        var _a7, _b2, _c2;
        this.name = "LibraryEngine";
        this.libraryLoader = r != null ? r : Ha, t.engineWasm !== void 0 && (this.libraryLoader = r != null ? r : Ka), this.config = t, this.libraryStarted = false, this.logQueries = (_a7 = t.logQueries) != null ? _a7 : false, this.logLevel = (_b2 = t.logLevel) != null ? _b2 : "error", this.logEmitter = t.logEmitter, this.datamodel = t.inlineSchema, t.enableDebugLogs && (this.logLevel = "debug");
        let n = Object.keys(t.overrideDatasources)[0], i = (_c2 = t.overrideDatasources[n]) == null ? void 0 : _c2.url;
        n !== void 0 && i !== void 0 && (this.datasourceOverrides = { [n]: i }), this.libraryInstantiationPromise = this.instantiateLibrary();
      }
      applyPendingMigrations() {
        return __async(this, null, function* () {
          throw new Error("Cannot call this method from this type of engine instance");
        });
      }
      transaction(t, r, n) {
        return __async(this, null, function* () {
          var _a7, _b2, _c2;
          yield this.start();
          let i = JSON.stringify(r), o;
          if (t === "start") {
            let a = JSON.stringify({ max_wait: n.maxWait, timeout: n.timeout, isolation_level: n.isolationLevel });
            o = yield (_a7 = this.engine) == null ? void 0 : _a7.startTransaction(a, i);
          } else t === "commit" ? o = yield (_b2 = this.engine) == null ? void 0 : _b2.commitTransaction(n.id, i) : t === "rollback" && (o = yield (_c2 = this.engine) == null ? void 0 : _c2.rollbackTransaction(n.id, i));
          let s = this.parseEngineResponse(o);
          if (kd(s)) {
            let a = this.getExternalAdapterError(s);
            throw a ? a.error : new V(s.message, { code: s.error_code, clientVersion: this.config.clientVersion, meta: s.meta });
          }
          return s;
        });
      }
      instantiateLibrary() {
        return __async(this, null, function* () {
          if (Ae("internalSetup"), this.libraryInstantiationPromise) return this.libraryInstantiationPromise;
          Gn(), this.binaryTarget = yield this.getCurrentBinaryTarget(), yield this.loadEngine(), this.version();
        });
      }
      getCurrentBinaryTarget() {
        return __async(this, null, function* () {
          {
            if (this.binaryTarget) return this.binaryTarget;
            let t = yield nt();
            if (!za.includes(t)) throw new R(`Unknown ${ce("PRISMA_QUERY_ENGINE_LIBRARY")} ${ce(H(t))}. Possible binaryTargets: ${qe(za.join(", "))} or a path to the query engine library.
You may have to run ${qe("prisma generate")} for your changes to take effect.`, this.config.clientVersion);
            return t;
          }
        });
      }
      parseEngineResponse(t) {
        if (!t) throw new B("Response from the Engine was empty", { clientVersion: this.config.clientVersion });
        try {
          return JSON.parse(t);
        } catch (e) {
          throw new B("Unable to JSON.parse response from engine", { clientVersion: this.config.clientVersion });
        }
      }
      loadEngine() {
        return __async(this, null, function* () {
          var _a7, _b2;
          if (!this.engine) {
            this.QueryEngineConstructor || (this.library = yield this.libraryLoader.loadLibrary(this.config), this.QueryEngineConstructor = this.library.QueryEngine);
            try {
              let t = new WeakRef(this), { adapter: r } = this.config;
              r && Ae("Using driver adapter: %O", r), this.engine = new this.QueryEngineConstructor({ datamodel: this.datamodel, env: process.env, logQueries: (_a7 = this.config.logQueries) != null ? _a7 : false, ignoreEnvVarErrors: true, datasourceOverrides: (_b2 = this.datasourceOverrides) != null ? _b2 : {}, logLevel: this.logLevel, configDir: this.config.cwd, engineProtocol: "json" }, (n) => {
                var _a8;
                (_a8 = t.deref()) == null ? void 0 : _a8.logger(n);
              }, r);
            } catch (t) {
              let r = t, n = this.parseInitError(r.message);
              throw typeof n == "string" ? r : new R(n.message, this.config.clientVersion, n.error_code);
            }
          }
        });
      }
      logger(t) {
        var _a7;
        let r = this.parseEngineResponse(t);
        if (r) {
          if ("span" in r) {
            this.config.tracingHelper.createEngineSpan(r);
            return;
          }
          r.level = (_a7 = r == null ? void 0 : r.level.toLowerCase()) != null ? _a7 : "unknown", Id(r) ? this.logEmitter.emit("query", { timestamp: /* @__PURE__ */ new Date(), query: r.query, params: r.params, duration: Number(r.duration_ms), target: r.module_path }) : Od(r) ? this.loggerRustPanic = new le(ro(this, `${r.message}: ${r.reason} in ${r.file}:${r.line}:${r.column}`), this.config.clientVersion) : this.logEmitter.emit(r.level, { timestamp: /* @__PURE__ */ new Date(), message: r.message, target: r.module_path });
        }
      }
      parseInitError(t) {
        try {
          return JSON.parse(t);
        } catch (e) {
        }
        return t;
      }
      parseRequestError(t) {
        try {
          return JSON.parse(t);
        } catch (e) {
        }
        return t;
      }
      onBeforeExit() {
        throw new Error('"beforeExit" hook is not applicable to the library engine since Prisma 5.0.0, it is only relevant and implemented for the binary engine. Please add your event listener to the `process` object directly instead.');
      }
      start() {
        return __async(this, null, function* () {
          if (yield this.libraryInstantiationPromise, yield this.libraryStoppingPromise, this.libraryStartingPromise) return Ae(`library already starting, this.libraryStarted: ${this.libraryStarted}`), this.libraryStartingPromise;
          if (this.libraryStarted) return;
          let t = () => __async(this, null, function* () {
            var _a7;
            Ae("library starting");
            try {
              let r = { traceparent: this.config.tracingHelper.getTraceParent() };
              yield (_a7 = this.engine) == null ? void 0 : _a7.connect(JSON.stringify(r)), this.libraryStarted = true, Ae("library started");
            } catch (r) {
              let n = this.parseInitError(r.message);
              throw typeof n == "string" ? r : new R(n.message, this.config.clientVersion, n.error_code);
            } finally {
              this.libraryStartingPromise = void 0;
            }
          });
          return this.libraryStartingPromise = this.config.tracingHelper.runInChildSpan("connect", t), this.libraryStartingPromise;
        });
      }
      stop() {
        return __async(this, null, function* () {
          if (yield this.libraryStartingPromise, yield this.executingQueryPromise, this.libraryStoppingPromise) return Ae("library is already stopping"), this.libraryStoppingPromise;
          if (!this.libraryStarted) return;
          let t = () => __async(this, null, function* () {
            var _a7;
            yield new Promise((n) => setTimeout(n, 5)), Ae("library stopping");
            let r = { traceparent: this.config.tracingHelper.getTraceParent() };
            yield (_a7 = this.engine) == null ? void 0 : _a7.disconnect(JSON.stringify(r)), this.libraryStarted = false, this.libraryStoppingPromise = void 0, Ae("library stopped");
          });
          return this.libraryStoppingPromise = this.config.tracingHelper.runInChildSpan("disconnect", t), this.libraryStoppingPromise;
        });
      }
      version() {
        var _a7, _b2, _c2;
        return this.versionInfo = (_a7 = this.library) == null ? void 0 : _a7.version(), (_c2 = (_b2 = this.versionInfo) == null ? void 0 : _b2.version) != null ? _c2 : "unknown";
      }
      debugPanic(t) {
        var _a7;
        return (_a7 = this.library) == null ? void 0 : _a7.debugPanic(t);
      }
      request(_0, _1) {
        return __async(this, arguments, function* (t, { traceparent: r, interactiveTransaction: n }) {
          var _a7, _b2;
          Ae(`sending request, this.libraryStarted: ${this.libraryStarted}`);
          let i = JSON.stringify({ traceparent: r }), o = JSON.stringify(t);
          try {
            yield this.start(), this.executingQueryPromise = (_a7 = this.engine) == null ? void 0 : _a7.query(o, i, n == null ? void 0 : n.id), this.lastQuery = o;
            let s = this.parseEngineResponse(yield this.executingQueryPromise);
            if (s.errors) throw s.errors.length === 1 ? this.buildQueryError(s.errors[0]) : new B(JSON.stringify(s.errors), { clientVersion: this.config.clientVersion });
            if (this.loggerRustPanic) throw this.loggerRustPanic;
            return { data: s, elapsed: 0 };
          } catch (s) {
            if (s instanceof R) throw s;
            if (s.code === "GenericFailure" && ((_b2 = s.message) == null ? void 0 : _b2.startsWith("PANIC:"))) throw new le(ro(this, s.message), this.config.clientVersion);
            let a = this.parseRequestError(s.message);
            throw typeof a == "string" ? s : new B(`${a.message}
${a.backtrace}`, { clientVersion: this.config.clientVersion });
          }
        });
      }
      requestBatch(_0, _1) {
        return __async(this, arguments, function* (t, { transaction: r, traceparent: n }) {
          Ae("requestBatch");
          let i = wt(t, r);
          yield this.start(), this.lastQuery = JSON.stringify(i), this.executingQueryPromise = this.engine.query(this.lastQuery, JSON.stringify({ traceparent: n }), Ja(r));
          let o = yield this.executingQueryPromise, s = this.parseEngineResponse(o);
          if (s.errors) throw s.errors.length === 1 ? this.buildQueryError(s.errors[0]) : new B(JSON.stringify(s.errors), { clientVersion: this.config.clientVersion });
          let { batchResult: a, errors: l } = s;
          if (Array.isArray(a)) return a.map((u) => {
            var _a7;
            return u.errors && u.errors.length > 0 ? (_a7 = this.loggerRustPanic) != null ? _a7 : this.buildQueryError(u.errors[0]) : { data: u, elapsed: 0 };
          });
          throw l && l.length === 1 ? new Error(l[0].error) : new Error(JSON.stringify(s));
        });
      }
      buildQueryError(t) {
        if (t.user_facing_error.is_panic) return new le(ro(this, t.user_facing_error.message), this.config.clientVersion);
        let r = this.getExternalAdapterError(t.user_facing_error);
        return r ? r.error : st(t, this.config.clientVersion, this.config.activeProvider);
      }
      getExternalAdapterError(t) {
        var _a7;
        if (t.error_code === Ad && this.config.adapter) {
          let r = (_a7 = t.meta) == null ? void 0 : _a7.id;
          zr(typeof r == "number", "Malformed external JS error received from the engine");
          let n = this.config.adapter.errorRegistry.consumeError(r);
          return zr(n, "External error with reported id was not registered"), n;
        }
      }
      metrics(t) {
        return __async(this, null, function* () {
          yield this.start();
          let r = yield this.engine.metrics(JSON.stringify(t));
          return t.format === "prometheus" ? r : this.parseEngineResponse(r);
        });
      }
    };
    function kd(e) {
      return typeof e == "object" && e !== null && e.error_code !== void 0;
    }
    function ro(e, t) {
      var _a7;
      return Ma({ binaryTarget: e.binaryTarget, title: t, version: e.config.clientVersion, engineVersion: (_a7 = e.versionInfo) == null ? void 0 : _a7.commit, database: e.config.activeProvider, query: e.lastQuery });
    }
    function Ya({ copyEngine: e = true }, t) {
      let r;
      try {
        r = _t({ inlineDatasources: t.inlineDatasources, overrideDatasources: t.overrideDatasources, env: __spreadValues(__spreadValues({}, t.env), process.env), clientVersion: t.clientVersion });
      } catch (e2) {
      }
      let n = !!((r == null ? void 0 : r.startsWith("prisma://")) || (r == null ? void 0 : r.startsWith("prisma+postgres://")));
      e && n && Xt("recommend--no-engine", "In production, we recommend using `prisma generate --no-engine` (See: `prisma generate --help`)");
      let i = Kt(t.generator), o = n || !e, s = !!t.adapter, a = i === "library", l = i === "binary";
      if (o && s || s && false) {
        let u;
        throw e ? (r == null ? void 0 : r.startsWith("prisma://")) ? u = ["Prisma Client was configured to use the `adapter` option but the URL was a `prisma://` URL.", "Please either use the `prisma://` URL or remove the `adapter` from the Prisma Client constructor."] : u = ["Prisma Client was configured to use both the `adapter` and Accelerate, please chose one."] : u = ["Prisma Client was configured to use the `adapter` option but `prisma generate` was run with `--no-engine`.", "Please run `prisma generate` without `--no-engine` to be able to use Prisma Client with the adapter."], new J(u.join(`
`), { clientVersion: t.clientVersion });
      }
      if (o) return new Sr(t);
      if (a) return new Ar(t);
      throw new J("Invalid client engine type, please use `library` or `binary`", { clientVersion: t.clientVersion });
    }
    function In({ generator: e }) {
      var _a7;
      return (_a7 = e == null ? void 0 : e.previewFeatures) != null ? _a7 : [];
    }
    function Mt(e) {
      return e.substring(0, 1).toLowerCase() + e.substring(1);
    }
    var nl = k(no());
    function tl(e, t, r) {
      let n = rl(e), i = Dd(n), o = Fd(i);
      o ? On(o, t, r) : t.addErrorMessage(() => "Unknown error");
    }
    function rl(e) {
      return e.errors.flatMap((t) => t.kind === "Union" ? rl(t) : [t]);
    }
    function Dd(e) {
      let t = /* @__PURE__ */ new Map(), r = [];
      for (let n of e) {
        if (n.kind !== "InvalidArgumentType") {
          r.push(n);
          continue;
        }
        let i = `${n.selectionPath.join(".")}:${n.argumentPath.join(".")}`, o = t.get(i);
        o ? t.set(i, __spreadProps(__spreadValues({}, n), { argument: __spreadProps(__spreadValues({}, n.argument), { typeNames: _d(o.argument.typeNames, n.argument.typeNames) }) })) : t.set(i, n);
      }
      return r.push(...t.values()), r;
    }
    function _d(e, t) {
      return [...new Set(e.concat(t))];
    }
    function Fd(e) {
      return wi(e, (t, r) => {
        let n = Xa(t), i = Xa(r);
        return n !== i ? n - i : el(t) - el(r);
      });
    }
    function Xa(e) {
      let t = 0;
      return Array.isArray(e.selectionPath) && (t += e.selectionPath.length), Array.isArray(e.argumentPath) && (t += e.argumentPath.length), t;
    }
    function el(e) {
      switch (e.kind) {
        case "InvalidArgumentValue":
        case "ValueTooLarge":
          return 20;
        case "InvalidArgumentType":
          return 10;
        case "RequiredArgumentMissing":
          return -10;
        default:
          return 0;
      }
    }
    var ue = class {
      constructor(t, r) {
        this.name = t;
        this.value = r;
        this.isRequired = false;
      }
      makeRequired() {
        return this.isRequired = true, this;
      }
      write(t) {
        let { colors: { green: r } } = t.context;
        t.addMarginSymbol(r(this.isRequired ? "+" : "?")), t.write(r(this.name)), this.isRequired || t.write(r("?")), t.write(r(": ")), typeof this.value == "string" ? t.write(r(this.value)) : t.write(this.value);
      }
    };
    var Ir = class {
      constructor() {
        this.fields = [];
      }
      addField(t, r) {
        return this.fields.push({ write(n) {
          let { green: i, dim: o } = n.context.colors;
          n.write(i(o(`${t}: ${r}`))).addMarginSymbol(i(o("+")));
        } }), this;
      }
      write(t) {
        let { colors: { green: r } } = t.context;
        t.writeLine(r("{")).withIndent(() => {
          t.writeJoined(St, this.fields).newLine();
        }).write(r("}")).addMarginSymbol(r("+"));
      }
    };
    function On(e, t, r) {
      switch (e.kind) {
        case "MutuallyExclusiveFields":
          Ld(e, t);
          break;
        case "IncludeOnScalar":
          Nd(e, t);
          break;
        case "EmptySelection":
          Md(e, t, r);
          break;
        case "UnknownSelectionField":
          Vd(e, t);
          break;
        case "InvalidSelectionValue":
          Bd(e, t);
          break;
        case "UnknownArgument":
          Ud(e, t);
          break;
        case "UnknownInputField":
          Gd(e, t);
          break;
        case "RequiredArgumentMissing":
          Qd(e, t);
          break;
        case "InvalidArgumentType":
          Jd(e, t);
          break;
        case "InvalidArgumentValue":
          Wd(e, t);
          break;
        case "ValueTooLarge":
          Hd(e, t);
          break;
        case "SomeFieldsMissing":
          Kd(e, t);
          break;
        case "TooManyFieldsGiven":
          zd(e, t);
          break;
        case "Union":
          tl(e, t, r);
          break;
        default:
          throw new Error("not implemented: " + e.kind);
      }
    }
    function Ld(e, t) {
      var _a7, _b2, _c2;
      let r = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      r && ((_b2 = r.getField(e.firstField)) == null ? void 0 : _b2.markAsError(), (_c2 = r.getField(e.secondField)) == null ? void 0 : _c2.markAsError()), t.addErrorMessage((n) => `Please ${n.bold("either")} use ${n.green(`\`${e.firstField}\``)} or ${n.green(`\`${e.secondField}\``)}, but ${n.red("not both")} at the same time.`);
    }
    function Nd(e, t) {
      var _a7, _b2;
      let [r, n] = Or(e.selectionPath), i = e.outputType, o = (_a7 = t.arguments.getDeepSelectionParent(r)) == null ? void 0 : _a7.value;
      if (o && ((_b2 = o.getField(n)) == null ? void 0 : _b2.markAsError(), i)) for (let s of i.fields) s.isRelation && o.addSuggestion(new ue(s.name, "true"));
      t.addErrorMessage((s) => {
        let a = `Invalid scalar field ${s.red(`\`${n}\``)} for ${s.bold("include")} statement`;
        return i ? a += ` on model ${s.bold(i.name)}. ${kr(s)}` : a += ".", a += `
Note that ${s.bold("include")} statements only accept relation fields.`, a;
      });
    }
    function Md(e, t, r) {
      var _a7, _b2;
      let n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      if (n) {
        let i = (_b2 = n.getField("omit")) == null ? void 0 : _b2.value.asObject();
        if (i) {
          $d(e, t, i);
          return;
        }
        if (n.hasField("select")) {
          qd(e, t);
          return;
        }
      }
      if (r == null ? void 0 : r[Mt(e.outputType.name)]) {
        jd(e, t);
        return;
      }
      t.addErrorMessage(() => `Unknown field at "${e.selectionPath.join(".")} selection"`);
    }
    function $d(e, t, r) {
      r.removeAllFields();
      for (let n of e.outputType.fields) r.addSuggestion(new ue(n.name, "false"));
      t.addErrorMessage((n) => `The ${n.red("omit")} statement includes every field of the model ${n.bold(e.outputType.name)}. At least one field must be included in the result`);
    }
    function qd(e, t) {
      var _a7, _b2;
      let r = e.outputType, n = (_a7 = t.arguments.getDeepSelectionParent(e.selectionPath)) == null ? void 0 : _a7.value, i = (_b2 = n == null ? void 0 : n.isEmpty()) != null ? _b2 : false;
      n && (n.removeAllFields(), sl(n, r)), t.addErrorMessage((o) => i ? `The ${o.red("`select`")} statement for type ${o.bold(r.name)} must not be empty. ${kr(o)}` : `The ${o.red("`select`")} statement for type ${o.bold(r.name)} needs ${o.bold("at least one truthy value")}.`);
    }
    function jd(e, t) {
      var _a7, _b2, _c2;
      let r = new Ir();
      for (let i of e.outputType.fields) i.isRelation || r.addField(i.name, "false");
      let n = new ue("omit", r).makeRequired();
      if (e.selectionPath.length === 0) t.arguments.addSuggestion(n);
      else {
        let [i, o] = Or(e.selectionPath), a = (_b2 = (_a7 = t.arguments.getDeepSelectionParent(i)) == null ? void 0 : _a7.value.asObject()) == null ? void 0 : _b2.getField(o);
        if (a) {
          let l = (_c2 = a == null ? void 0 : a.value.asObject()) != null ? _c2 : new It();
          l.addSuggestion(n), a.value = l;
        }
      }
      t.addErrorMessage((i) => `The global ${i.red("omit")} configuration excludes every field of the model ${i.bold(e.outputType.name)}. At least one field must be included in the result`);
    }
    function Vd(e, t) {
      let r = al(e.selectionPath, t);
      if (r.parentKind !== "unknown") {
        r.field.markAsError();
        let n = r.parent;
        switch (r.parentKind) {
          case "select":
            sl(n, e.outputType);
            break;
          case "include":
            Yd(n, e.outputType);
            break;
          case "omit":
            Zd(n, e.outputType);
            break;
        }
      }
      t.addErrorMessage((n) => {
        let i = [`Unknown field ${n.red(`\`${r.fieldName}\``)}`];
        return r.parentKind !== "unknown" && i.push(`for ${n.bold(r.parentKind)} statement`), i.push(`on model ${n.bold(`\`${e.outputType.name}\``)}.`), i.push(kr(n)), i.join(" ");
      });
    }
    function Bd(e, t) {
      let r = al(e.selectionPath, t);
      r.parentKind !== "unknown" && r.field.value.markAsError(), t.addErrorMessage((n) => `Invalid value for selection field \`${n.red(r.fieldName)}\`: ${e.underlyingError}`);
    }
    function Ud(e, t) {
      var _a7, _b2;
      let r = e.argumentPath[0], n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      n && ((_b2 = n.getField(r)) == null ? void 0 : _b2.markAsError(), Xd(n, e.arguments)), t.addErrorMessage((i) => il(i, r, e.arguments.map((o) => o.name)));
    }
    function Gd(e, t) {
      var _a7, _b2, _c2;
      let [r, n] = Or(e.argumentPath), i = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      if (i) {
        (_b2 = i.getDeepField(e.argumentPath)) == null ? void 0 : _b2.markAsError();
        let o = (_c2 = i.getDeepFieldValue(r)) == null ? void 0 : _c2.asObject();
        o && ll(o, e.inputType);
      }
      t.addErrorMessage((o) => il(o, n, e.inputType.fields.map((s) => s.name)));
    }
    function il(e, t, r) {
      let n = [`Unknown argument \`${e.red(t)}\`.`], i = tm(t, r);
      return i && n.push(`Did you mean \`${e.green(i)}\`?`), r.length > 0 && n.push(kr(e)), n.join(" ");
    }
    function Qd(e, t) {
      var _a7, _b2;
      let r;
      t.addErrorMessage((l) => (r == null ? void 0 : r.value) instanceof W && r.value.text === "null" ? `Argument \`${l.green(o)}\` must not be ${l.red("null")}.` : `Argument \`${l.green(o)}\` is missing.`);
      let n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      if (!n) return;
      let [i, o] = Or(e.argumentPath), s = new Ir(), a = (_b2 = n.getDeepFieldValue(i)) == null ? void 0 : _b2.asObject();
      if (a) if (r = a.getField(o), r && a.removeField(o), e.inputTypes.length === 1 && e.inputTypes[0].kind === "object") {
        for (let l of e.inputTypes[0].fields) s.addField(l.name, l.typeNames.join(" | "));
        a.addSuggestion(new ue(o, s).makeRequired());
      } else {
        let l = e.inputTypes.map(ol).join(" | ");
        a.addSuggestion(new ue(o, l).makeRequired());
      }
    }
    function ol(e) {
      return e.kind === "list" ? `${ol(e.elementType)}[]` : e.name;
    }
    function Jd(e, t) {
      var _a7, _b2;
      let r = e.argument.name, n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      n && ((_b2 = n.getDeepFieldValue(e.argumentPath)) == null ? void 0 : _b2.markAsError()), t.addErrorMessage((i) => {
        let o = kn("or", e.argument.typeNames.map((s) => i.green(s)));
        return `Argument \`${i.bold(r)}\`: Invalid value provided. Expected ${o}, provided ${i.red(e.inferredType)}.`;
      });
    }
    function Wd(e, t) {
      var _a7, _b2;
      let r = e.argument.name, n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      n && ((_b2 = n.getDeepFieldValue(e.argumentPath)) == null ? void 0 : _b2.markAsError()), t.addErrorMessage((i) => {
        let o = [`Invalid value for argument \`${i.bold(r)}\``];
        if (e.underlyingError && o.push(`: ${e.underlyingError}`), o.push("."), e.argument.typeNames.length > 0) {
          let s = kn("or", e.argument.typeNames.map((a) => i.green(a)));
          o.push(` Expected ${s}.`);
        }
        return o.join("");
      });
    }
    function Hd(e, t) {
      var _a7, _b2;
      let r = e.argument.name, n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject(), i;
      if (n) {
        let s = (_b2 = n.getDeepField(e.argumentPath)) == null ? void 0 : _b2.value;
        s == null ? void 0 : s.markAsError(), s instanceof W && (i = s.text);
      }
      t.addErrorMessage((o) => {
        let s = ["Unable to fit value"];
        return i && s.push(o.red(i)), s.push(`into a 64-bit signed integer for field \`${o.bold(r)}\``), s.join(" ");
      });
    }
    function Kd(e, t) {
      var _a7, _b2;
      let r = e.argumentPath[e.argumentPath.length - 1], n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject();
      if (n) {
        let i = (_b2 = n.getDeepFieldValue(e.argumentPath)) == null ? void 0 : _b2.asObject();
        i && ll(i, e.inputType);
      }
      t.addErrorMessage((i) => {
        let o = [`Argument \`${i.bold(r)}\` of type ${i.bold(e.inputType.name)} needs`];
        return e.constraints.minFieldCount === 1 ? e.constraints.requiredFields ? o.push(`${i.green("at least one of")} ${kn("or", e.constraints.requiredFields.map((s) => `\`${i.bold(s)}\``))} arguments.`) : o.push(`${i.green("at least one")} argument.`) : o.push(`${i.green(`at least ${e.constraints.minFieldCount}`)} arguments.`), o.push(kr(i)), o.join(" ");
      });
    }
    function zd(e, t) {
      var _a7, _b2;
      let r = e.argumentPath[e.argumentPath.length - 1], n = (_a7 = t.arguments.getDeepSubSelectionValue(e.selectionPath)) == null ? void 0 : _a7.asObject(), i = [];
      if (n) {
        let o = (_b2 = n.getDeepFieldValue(e.argumentPath)) == null ? void 0 : _b2.asObject();
        o && (o.markAsError(), i = Object.keys(o.getFields()));
      }
      t.addErrorMessage((o) => {
        let s = [`Argument \`${o.bold(r)}\` of type ${o.bold(e.inputType.name)} needs`];
        return e.constraints.minFieldCount === 1 && e.constraints.maxFieldCount == 1 ? s.push(`${o.green("exactly one")} argument,`) : e.constraints.maxFieldCount == 1 ? s.push(`${o.green("at most one")} argument,`) : s.push(`${o.green(`at most ${e.constraints.maxFieldCount}`)} arguments,`), s.push(`but you provided ${kn("and", i.map((a) => o.red(a)))}. Please choose`), e.constraints.maxFieldCount === 1 ? s.push("one.") : s.push(`${e.constraints.maxFieldCount}.`), s.join(" ");
      });
    }
    function sl(e, t) {
      for (let r of t.fields) e.hasField(r.name) || e.addSuggestion(new ue(r.name, "true"));
    }
    function Yd(e, t) {
      for (let r of t.fields) r.isRelation && !e.hasField(r.name) && e.addSuggestion(new ue(r.name, "true"));
    }
    function Zd(e, t) {
      for (let r of t.fields) !e.hasField(r.name) && !r.isRelation && e.addSuggestion(new ue(r.name, "true"));
    }
    function Xd(e, t) {
      for (let r of t) e.hasField(r.name) || e.addSuggestion(new ue(r.name, r.typeNames.join(" | ")));
    }
    function al(e, t) {
      var _a7, _b2, _c2, _d2;
      let [r, n] = Or(e), i = (_a7 = t.arguments.getDeepSubSelectionValue(r)) == null ? void 0 : _a7.asObject();
      if (!i) return { parentKind: "unknown", fieldName: n };
      let o = (_b2 = i.getFieldValue("select")) == null ? void 0 : _b2.asObject(), s = (_c2 = i.getFieldValue("include")) == null ? void 0 : _c2.asObject(), a = (_d2 = i.getFieldValue("omit")) == null ? void 0 : _d2.asObject(), l = o == null ? void 0 : o.getField(n);
      return o && l ? { parentKind: "select", parent: o, field: l, fieldName: n } : (l = s == null ? void 0 : s.getField(n), s && l ? { parentKind: "include", field: l, parent: s, fieldName: n } : (l = a == null ? void 0 : a.getField(n), a && l ? { parentKind: "omit", field: l, parent: a, fieldName: n } : { parentKind: "unknown", fieldName: n }));
    }
    function ll(e, t) {
      if (t.kind === "object") for (let r of t.fields) e.hasField(r.name) || e.addSuggestion(new ue(r.name, r.typeNames.join(" | ")));
    }
    function Or(e) {
      let t = [...e], r = t.pop();
      if (!r) throw new Error("unexpected empty path");
      return [t, r];
    }
    function kr({ green: e, enabled: t }) {
      return "Available options are " + (t ? `listed in ${e("green")}` : "marked with ?") + ".";
    }
    function kn(e, t) {
      if (t.length === 1) return t[0];
      let r = [...t], n = r.pop();
      return `${r.join(", ")} ${e} ${n}`;
    }
    var em = 3;
    function tm(e, t) {
      let r = 1 / 0, n;
      for (let i of t) {
        let o = (0, nl.default)(e, i);
        o > em || o < r && (r = o, n = i);
      }
      return n;
    }
    function Dn({ args: e, errors: t, errorFormat: r, callsite: n, originalMethod: i, clientVersion: o, globalOmit: s }) {
      let a = Ot(e);
      for (let p of t) On(p, a, s);
      let { message: l, args: u } = yn(a, r), c = Dt({ message: l, callsite: n, originalMethod: i, showColors: r === "pretty", callArguments: u });
      throw new J(c, { clientVersion: o });
    }
    var rm = { findUnique: "findUnique", findUniqueOrThrow: "findUniqueOrThrow", findFirst: "findFirst", findFirstOrThrow: "findFirstOrThrow", findMany: "findMany", count: "aggregate", create: "createOne", createMany: "createMany", createManyAndReturn: "createManyAndReturn", update: "updateOne", updateMany: "updateMany", upsert: "upsertOne", delete: "deleteOne", deleteMany: "deleteMany", executeRaw: "executeRaw", queryRaw: "queryRaw", aggregate: "aggregate", groupBy: "groupBy", runCommandRaw: "runCommandRaw", findRaw: "findRaw", aggregateRaw: "aggregateRaw" };
    var ul = "explicitly `undefined` values are not allowed";
    function cl({ modelName: e, action: t, args: r, runtimeDataModel: n, extensions: i, callsite: o, clientMethod: s, errorFormat: a, clientVersion: l, previewFeatures: u, globalOmit: c }) {
      let p = new io({ runtimeDataModel: n, modelName: e, action: t, rootArgs: r, callsite: o, extensions: i, selectionPath: [], argumentPath: [], originalMethod: s, errorFormat: a, clientVersion: l, previewFeatures: u, globalOmit: c });
      return { modelName: e, action: rm[t], query: Dr(r, p) };
    }
    function Dr(_a7 = {}, n) {
      var _b2 = _a7, { select: e, include: t } = _b2, r = __objRest(_b2, ["select", "include"]);
      let i;
      return n.isPreviewFeatureOn("omitApi") && (i = r.omit, delete r.omit), { arguments: dl(r, n), selection: nm(e, t, i, n) };
    }
    function nm(e, t, r, n) {
      return e ? (t ? n.throwValidationError({ kind: "MutuallyExclusiveFields", firstField: "include", secondField: "select", selectionPath: n.getSelectionPath() }) : r && n.isPreviewFeatureOn("omitApi") && n.throwValidationError({ kind: "MutuallyExclusiveFields", firstField: "omit", secondField: "select", selectionPath: n.getSelectionPath() }), am(e, n)) : im(n, t, r);
    }
    function im(e, t, r) {
      let n = {};
      return e.modelOrType && !e.isRawAction() && (n.$composites = true, n.$scalars = true), t && om(n, t, e), e.isPreviewFeatureOn("omitApi") && sm(n, r, e), n;
    }
    function om(e, t, r) {
      for (let [n, i] of Object.entries(t)) {
        if (we(i)) continue;
        let o = r.nestSelection(n);
        if (oo(i, o), i === false || i === void 0) {
          e[n] = false;
          continue;
        }
        let s = r.findField(n);
        if (s && s.kind !== "object" && r.throwValidationError({ kind: "IncludeOnScalar", selectionPath: r.getSelectionPath().concat(n), outputType: r.getOutputTypeDescription() }), s) {
          e[n] = Dr(i === true ? {} : i, o);
          continue;
        }
        if (i === true) {
          e[n] = true;
          continue;
        }
        e[n] = Dr(i, o);
      }
    }
    function sm(e, t, r) {
      let n = r.getComputedFields(), i = __spreadValues(__spreadValues({}, r.getGlobalOmit()), t), o = wa(i, n);
      for (let [s, a] of Object.entries(o)) {
        if (we(a)) continue;
        oo(a, r.nestSelection(s));
        let l = r.findField(s);
        (n == null ? void 0 : n[s]) && !l || (e[s] = !a);
      }
    }
    function am(e, t) {
      let r = {}, n = t.getComputedFields(), i = Ea(e, n);
      for (let [o, s] of Object.entries(i)) {
        if (we(s)) continue;
        let a = t.nestSelection(o);
        oo(s, a);
        let l = t.findField(o);
        if (!((n == null ? void 0 : n[o]) && !l)) {
          if (s === false || s === void 0 || we(s)) {
            r[o] = false;
            continue;
          }
          if (s === true) {
            (l == null ? void 0 : l.kind) === "object" ? r[o] = Dr({}, a) : r[o] = true;
            continue;
          }
          r[o] = Dr(s, a);
        }
      }
      return r;
    }
    function pl(e, t) {
      if (e === null) return null;
      if (typeof e == "string" || typeof e == "number" || typeof e == "boolean") return e;
      if (typeof e == "bigint") return { $type: "BigInt", value: String(e) };
      if (Pt(e)) {
        if (on(e)) return { $type: "DateTime", value: e.toISOString() };
        t.throwValidationError({ kind: "InvalidArgumentValue", selectionPath: t.getSelectionPath(), argumentPath: t.getArgumentPath(), argument: { name: t.getArgumentName(), typeNames: ["Date"] }, underlyingError: "Provided Date object is invalid" });
      }
      if (Ct(e)) return { $type: "FieldRef", value: { _ref: e.name, _container: e.modelName } };
      if (Array.isArray(e)) return lm(e, t);
      if (ArrayBuffer.isView(e)) return { $type: "Bytes", value: Buffer.from(e).toString("base64") };
      if (um(e)) return e.values;
      if (Rt(e)) return { $type: "Decimal", value: e.toFixed() };
      if (e instanceof Ne) {
        if (e !== en.instances[e._getName()]) throw new Error("Invalid ObjectEnumValue");
        return { $type: "Enum", value: e._getName() };
      }
      if (cm(e)) return e.toJSON();
      if (typeof e == "object") return dl(e, t);
      t.throwValidationError({ kind: "InvalidArgumentValue", selectionPath: t.getSelectionPath(), argumentPath: t.getArgumentPath(), argument: { name: t.getArgumentName(), typeNames: [] }, underlyingError: `We could not serialize ${Object.prototype.toString.call(e)} value. Serialize the object to JSON or implement a ".toJSON()" method on it` });
    }
    function dl(e, t) {
      if (e.$type) return { $type: "Raw", value: e };
      let r = {};
      for (let n in e) {
        let i = e[n], o = t.nestArgument(n);
        we(i) || (i !== void 0 ? r[n] = pl(i, o) : t.isPreviewFeatureOn("strictUndefinedChecks") && t.throwValidationError({ kind: "InvalidArgumentValue", argumentPath: o.getArgumentPath(), selectionPath: t.getSelectionPath(), argument: { name: t.getArgumentName(), typeNames: [] }, underlyingError: ul }));
      }
      return r;
    }
    function lm(e, t) {
      let r = [];
      for (let n = 0; n < e.length; n++) {
        let i = t.nestArgument(String(n)), o = e[n];
        if (o === void 0 || we(o)) {
          let s = o === void 0 ? "undefined" : "Prisma.skip";
          t.throwValidationError({ kind: "InvalidArgumentValue", selectionPath: i.getSelectionPath(), argumentPath: i.getArgumentPath(), argument: { name: `${t.getArgumentName()}[${n}]`, typeNames: [] }, underlyingError: `Can not use \`${s}\` value within array. Use \`null\` or filter out \`${s}\` values` });
        }
        r.push(pl(o, i));
      }
      return r;
    }
    function um(e) {
      return typeof e == "object" && e !== null && e.__prismaRawParameters__ === true;
    }
    function cm(e) {
      return typeof e == "object" && e !== null && typeof e.toJSON == "function";
    }
    function oo(e, t) {
      e === void 0 && t.isPreviewFeatureOn("strictUndefinedChecks") && t.throwValidationError({ kind: "InvalidSelectionValue", selectionPath: t.getSelectionPath(), underlyingError: ul });
    }
    var io = class e {
      constructor(t) {
        var _a7;
        this.params = t;
        this.params.modelName && (this.modelOrType = (_a7 = this.params.runtimeDataModel.models[this.params.modelName]) != null ? _a7 : this.params.runtimeDataModel.types[this.params.modelName]);
      }
      throwValidationError(t) {
        var _a7;
        Dn({ errors: [t], originalMethod: this.params.originalMethod, args: (_a7 = this.params.rootArgs) != null ? _a7 : {}, callsite: this.params.callsite, errorFormat: this.params.errorFormat, clientVersion: this.params.clientVersion, globalOmit: this.params.globalOmit });
      }
      getSelectionPath() {
        return this.params.selectionPath;
      }
      getArgumentPath() {
        return this.params.argumentPath;
      }
      getArgumentName() {
        return this.params.argumentPath[this.params.argumentPath.length - 1];
      }
      getOutputTypeDescription() {
        if (!(!this.params.modelName || !this.modelOrType)) return { name: this.params.modelName, fields: this.modelOrType.fields.map((t) => ({ name: t.name, typeName: "boolean", isRelation: t.kind === "object" })) };
      }
      isRawAction() {
        return ["executeRaw", "queryRaw", "runCommandRaw", "findRaw", "aggregateRaw"].includes(this.params.action);
      }
      isPreviewFeatureOn(t) {
        return this.params.previewFeatures.includes(t);
      }
      getComputedFields() {
        if (this.params.modelName) return this.params.extensions.getAllComputedFields(this.params.modelName);
      }
      findField(t) {
        var _a7;
        return (_a7 = this.modelOrType) == null ? void 0 : _a7.fields.find((r) => r.name === t);
      }
      nestSelection(t) {
        let r = this.findField(t), n = (r == null ? void 0 : r.kind) === "object" ? r.type : void 0;
        return new e(__spreadProps(__spreadValues({}, this.params), { modelName: n, selectionPath: this.params.selectionPath.concat(t) }));
      }
      getGlobalOmit() {
        var _a7, _b2;
        return this.params.modelName && this.shouldApplyGlobalOmit() ? (_b2 = (_a7 = this.params.globalOmit) == null ? void 0 : _a7[Mt(this.params.modelName)]) != null ? _b2 : {} : {};
      }
      shouldApplyGlobalOmit() {
        switch (this.params.action) {
          case "findFirst":
          case "findFirstOrThrow":
          case "findUniqueOrThrow":
          case "findMany":
          case "upsert":
          case "findUnique":
          case "createManyAndReturn":
          case "create":
          case "update":
          case "delete":
            return true;
          case "executeRaw":
          case "aggregateRaw":
          case "runCommandRaw":
          case "findRaw":
          case "createMany":
          case "deleteMany":
          case "groupBy":
          case "updateMany":
          case "count":
          case "aggregate":
          case "queryRaw":
            return false;
          default:
            Fe(this.params.action, "Unknown action");
        }
      }
      nestArgument(t) {
        return new e(__spreadProps(__spreadValues({}, this.params), { argumentPath: this.params.argumentPath.concat(t) }));
      }
    };
    var ml = (e) => ({ command: e });
    var fl = (e) => e.strings.reduce((t, r, n) => `${t}@P${n}${r}`);
    function $t(e) {
      try {
        return gl(e, "fast");
      } catch (e2) {
        return gl(e, "slow");
      }
    }
    function gl(e, t) {
      return JSON.stringify(e.map((r) => yl(r, t)));
    }
    function yl(e, t) {
      return Array.isArray(e) ? e.map((r) => yl(r, t)) : typeof e == "bigint" ? { prisma__type: "bigint", prisma__value: e.toString() } : Pt(e) ? { prisma__type: "date", prisma__value: e.toJSON() } : Re.isDecimal(e) ? { prisma__type: "decimal", prisma__value: e.toJSON() } : Buffer.isBuffer(e) ? { prisma__type: "bytes", prisma__value: e.toString("base64") } : pm(e) || ArrayBuffer.isView(e) ? { prisma__type: "bytes", prisma__value: Buffer.from(e).toString("base64") } : typeof e == "object" && t === "slow" ? bl(e) : e;
    }
    function pm(e) {
      return e instanceof ArrayBuffer || e instanceof SharedArrayBuffer ? true : typeof e == "object" && e !== null ? e[Symbol.toStringTag] === "ArrayBuffer" || e[Symbol.toStringTag] === "SharedArrayBuffer" : false;
    }
    function bl(e) {
      if (typeof e != "object" || e === null) return e;
      if (typeof e.toJSON == "function") return e.toJSON();
      if (Array.isArray(e)) return e.map(hl);
      let t = {};
      for (let r of Object.keys(e)) t[r] = hl(e[r]);
      return t;
    }
    function hl(e) {
      return typeof e == "bigint" ? e.toString() : bl(e);
    }
    var dm = ["$connect", "$disconnect", "$on", "$transaction", "$use", "$extends"];
    var El = dm;
    var mm = /^(\s*alter\s)/i;
    var wl = L("prisma:client");
    function so(e, t, r, n) {
      if (!(e !== "postgresql" && e !== "cockroachdb") && r.length > 0 && mm.exec(t)) throw new Error(`Running ALTER using ${n} is not supported
Using the example below you can still execute your query with Prisma, but please note that it is vulnerable to SQL injection attacks and requires you to take care of input sanitization.

Example:
  await prisma.$executeRawUnsafe(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

More Information: https://pris.ly/d/execute-raw
`);
    }
    var ao = ({ clientMethod: e, activeProvider: t }) => (r) => {
      let n = "", i;
      if (r instanceof sr) n = r.sql, i = { values: $t(r.values), __prismaRawParameters__: true };
      else if (Array.isArray(r)) {
        let [o, ...s] = r;
        n = o, i = { values: $t(s || []), __prismaRawParameters__: true };
      } else switch (t) {
        case "sqlite":
        case "mysql": {
          n = r.sql, i = { values: $t(r.values), __prismaRawParameters__: true };
          break;
        }
        case "cockroachdb":
        case "postgresql":
        case "postgres": {
          n = r.text, i = { values: $t(r.values), __prismaRawParameters__: true };
          break;
        }
        case "sqlserver": {
          n = fl(r), i = { values: $t(r.values), __prismaRawParameters__: true };
          break;
        }
        default:
          throw new Error(`The ${t} provider does not support ${e}`);
      }
      return (i == null ? void 0 : i.values) ? wl(`prisma.${e}(${n}, ${i.values})`) : wl(`prisma.${e}(${n})`), { query: n, parameters: i };
    };
    var xl = { requestArgsToMiddlewareArgs(e) {
      return [e.strings, ...e.values];
    }, middlewareArgsToRequestArgs(e) {
      let [t, ...r] = e;
      return new ie(t, r);
    } };
    var Pl = { requestArgsToMiddlewareArgs(e) {
      return [e];
    }, middlewareArgsToRequestArgs(e) {
      return e[0];
    } };
    function lo(e) {
      return function(r) {
        let n, i = (o = e) => {
          try {
            return o === void 0 || (o == null ? void 0 : o.kind) === "itx" ? n != null ? n : n = vl(r(o)) : vl(r(o));
          } catch (s) {
            return Promise.reject(s);
          }
        };
        return { then(o, s) {
          return i().then(o, s);
        }, catch(o) {
          return i().catch(o);
        }, finally(o) {
          return i().finally(o);
        }, requestTransaction(o) {
          let s = i(o);
          return s.requestTransaction ? s.requestTransaction(o) : s;
        }, [Symbol.toStringTag]: "PrismaPromise" };
      };
    }
    function vl(e) {
      return typeof e.then == "function" ? e : Promise.resolve(e);
    }
    var Tl = { isEnabled() {
      return false;
    }, getTraceParent() {
      return "00-10-10-00";
    }, createEngineSpan() {
      return __async(this, null, function* () {
      });
    }, getActiveContext() {
    }, runInChildSpan(e, t) {
      return t();
    } };
    var uo = class {
      isEnabled() {
        return this.getGlobalTracingHelper().isEnabled();
      }
      getTraceParent(t) {
        return this.getGlobalTracingHelper().getTraceParent(t);
      }
      createEngineSpan(t) {
        return this.getGlobalTracingHelper().createEngineSpan(t);
      }
      getActiveContext() {
        return this.getGlobalTracingHelper().getActiveContext();
      }
      runInChildSpan(t, r) {
        return this.getGlobalTracingHelper().runInChildSpan(t, r);
      }
      getGlobalTracingHelper() {
        var _a7, _b2;
        return (_b2 = (_a7 = globalThis.PRISMA_INSTRUMENTATION) == null ? void 0 : _a7.helper) != null ? _b2 : Tl;
      }
    };
    function Rl(e) {
      return e.includes("tracing") ? new uo() : Tl;
    }
    function Cl(e, t = () => {
    }) {
      let r, n = new Promise((i) => r = i);
      return { then(i) {
        return --e === 0 && r(t()), i == null ? void 0 : i(n);
      } };
    }
    function Sl(e) {
      return typeof e == "string" ? e : e.reduce((t, r) => {
        let n = typeof r == "string" ? r : r.level;
        return n === "query" ? t : t && (r === "info" || t === "info") ? "info" : n;
      }, void 0);
    }
    var _n = class {
      constructor() {
        this._middlewares = [];
      }
      use(t) {
        this._middlewares.push(t);
      }
      get(t) {
        return this._middlewares[t];
      }
      has(t) {
        return !!this._middlewares[t];
      }
      length() {
        return this._middlewares.length;
      }
    };
    var Ol = k(yi());
    function Fn(e) {
      return typeof e.batchRequestIdx == "number";
    }
    function Ln(e) {
      return e === null ? e : Array.isArray(e) ? e.map(Ln) : typeof e == "object" ? fm(e) ? gm(e) : yt(e, Ln) : e;
    }
    function fm(e) {
      return e !== null && typeof e == "object" && typeof e.$type == "string";
    }
    function gm({ $type: e, value: t }) {
      switch (e) {
        case "BigInt":
          return BigInt(t);
        case "Bytes":
          return Buffer.from(t, "base64");
        case "DateTime":
          return new Date(t);
        case "Decimal":
          return new Re(t);
        case "Json":
          return JSON.parse(t);
        default:
          Fe(t, "Unknown tagged value");
      }
    }
    function Al(e) {
      if (e.action !== "findUnique" && e.action !== "findUniqueOrThrow") return;
      let t = [];
      return e.modelName && t.push(e.modelName), e.query.arguments && t.push(co(e.query.arguments)), t.push(co(e.query.selection)), t.join("");
    }
    function co(e) {
      return `(${Object.keys(e).sort().map((r) => {
        let n = e[r];
        return typeof n == "object" && n !== null ? `(${r} ${co(n)})` : r;
      }).join(" ")})`;
    }
    var hm = { aggregate: false, aggregateRaw: false, createMany: true, createManyAndReturn: true, createOne: true, deleteMany: true, deleteOne: true, executeRaw: true, findFirst: false, findFirstOrThrow: false, findMany: false, findRaw: false, findUnique: false, findUniqueOrThrow: false, groupBy: false, queryRaw: false, runCommandRaw: true, updateMany: true, updateOne: true, upsertOne: true };
    function po(e) {
      return hm[e];
    }
    var Nn = class {
      constructor(t) {
        this.options = t;
        this.tickActive = false;
        this.batches = {};
      }
      request(t) {
        let r = this.options.batchBy(t);
        return r ? (this.batches[r] || (this.batches[r] = [], this.tickActive || (this.tickActive = true, process.nextTick(() => {
          this.dispatchBatches(), this.tickActive = false;
        }))), new Promise((n, i) => {
          this.batches[r].push({ request: t, resolve: n, reject: i });
        })) : this.options.singleLoader(t);
      }
      dispatchBatches() {
        for (let t in this.batches) {
          let r = this.batches[t];
          delete this.batches[t], r.length === 1 ? this.options.singleLoader(r[0].request).then((n) => {
            n instanceof Error ? r[0].reject(n) : r[0].resolve(n);
          }).catch((n) => {
            r[0].reject(n);
          }) : (r.sort((n, i) => this.options.batchOrder(n.request, i.request)), this.options.batchLoader(r.map((n) => n.request)).then((n) => {
            if (n instanceof Error) for (let i = 0; i < r.length; i++) r[i].reject(n);
            else for (let i = 0; i < r.length; i++) {
              let o = n[i];
              o instanceof Error ? r[i].reject(o) : r[i].resolve(o);
            }
          }).catch((n) => {
            for (let i = 0; i < r.length; i++) r[i].reject(n);
          }));
        }
      }
      get [Symbol.toStringTag]() {
        return "DataLoader";
      }
    };
    function pt(e, t) {
      if (t === null) return t;
      switch (e) {
        case "bigint":
          return BigInt(t);
        case "bytes":
          return Buffer.from(t, "base64");
        case "decimal":
          return new Re(t);
        case "datetime":
        case "date":
          return new Date(t);
        case "time":
          return /* @__PURE__ */ new Date(`1970-01-01T${t}Z`);
        case "bigint-array":
          return t.map((r) => pt("bigint", r));
        case "bytes-array":
          return t.map((r) => pt("bytes", r));
        case "decimal-array":
          return t.map((r) => pt("decimal", r));
        case "datetime-array":
          return t.map((r) => pt("datetime", r));
        case "date-array":
          return t.map((r) => pt("date", r));
        case "time-array":
          return t.map((r) => pt("time", r));
        default:
          return t;
      }
    }
    function Il(e) {
      let t = [], r = ym(e);
      for (let n = 0; n < e.rows.length; n++) {
        let i = e.rows[n], o = __spreadValues({}, r);
        for (let s = 0; s < i.length; s++) o[e.columns[s]] = pt(e.types[s], i[s]);
        t.push(o);
      }
      return t;
    }
    function ym(e) {
      let t = {};
      for (let r = 0; r < e.columns.length; r++) t[e.columns[r]] = null;
      return t;
    }
    var bm = L("prisma:client:request_handler");
    var Mn = class {
      constructor(t, r) {
        this.logEmitter = r, this.client = t, this.dataloader = new Nn({ batchLoader: fa((_0) => __async(this, [_0], function* ({ requests: n, customDataProxyFetch: i }) {
          let { transaction: o, otelParentCtx: s } = n[0], a = n.map((p) => p.protocolQuery), l = this.client._tracingHelper.getTraceParent(s), u = n.some((p) => po(p.protocolQuery.action));
          return (yield this.client._engine.requestBatch(a, { traceparent: l, transaction: Em(o), containsWrite: u, customDataProxyFetch: i })).map((p, d) => {
            if (p instanceof Error) return p;
            try {
              return this.mapQueryEngineResult(n[d], p);
            } catch (f) {
              return f;
            }
          });
        })), singleLoader: (n) => __async(this, null, function* () {
          var _a7;
          let i = ((_a7 = n.transaction) == null ? void 0 : _a7.kind) === "itx" ? kl(n.transaction) : void 0, o = yield this.client._engine.request(n.protocolQuery, { traceparent: this.client._tracingHelper.getTraceParent(), interactiveTransaction: i, isWrite: po(n.protocolQuery.action), customDataProxyFetch: n.customDataProxyFetch });
          return this.mapQueryEngineResult(n, o);
        }), batchBy: (n) => {
          var _a7;
          return ((_a7 = n.transaction) == null ? void 0 : _a7.id) ? `transaction-${n.transaction.id}` : Al(n.protocolQuery);
        }, batchOrder(n, i) {
          var _a7, _b2;
          return ((_a7 = n.transaction) == null ? void 0 : _a7.kind) === "batch" && ((_b2 = i.transaction) == null ? void 0 : _b2.kind) === "batch" ? n.transaction.index - i.transaction.index : 0;
        } });
      }
      request(t) {
        return __async(this, null, function* () {
          try {
            return yield this.dataloader.request(t);
          } catch (r) {
            let { clientMethod: n, callsite: i, transaction: o, args: s, modelName: a } = t;
            this.handleAndLogRequestError({ error: r, clientMethod: n, callsite: i, transaction: o, args: s, modelName: a, globalOmit: t.globalOmit });
          }
        });
      }
      mapQueryEngineResult({ dataPath: t, unpacker: r }, n) {
        let i = n == null ? void 0 : n.data, o = n == null ? void 0 : n.elapsed, s = this.unpack(i, t, r);
        return process.env.PRISMA_CLIENT_GET_TIME ? { data: s, elapsed: o } : s;
      }
      handleAndLogRequestError(t) {
        try {
          this.handleRequestError(t);
        } catch (r) {
          throw this.logEmitter && this.logEmitter.emit("error", { message: r.message, target: t.clientMethod, timestamp: /* @__PURE__ */ new Date() }), r;
        }
      }
      handleRequestError({ error: t, clientMethod: r, callsite: n, transaction: i, args: o, modelName: s, globalOmit: a }) {
        if (bm(t), wm(t, i) || t instanceof Le) throw t;
        if (t instanceof V && xm(t)) {
          let u = Dl(t.meta);
          Dn({ args: o, errors: [u], callsite: n, errorFormat: this.client._errorFormat, originalMethod: r, clientVersion: this.client._clientVersion, globalOmit: a });
        }
        let l = t.message;
        if (n && (l = Dt({ callsite: n, originalMethod: r, isPanic: t.isPanic, showColors: this.client._errorFormat === "pretty", message: l })), l = this.sanitizeMessage(l), t.code) {
          let u = s ? __spreadValues({ modelName: s }, t.meta) : t.meta;
          throw new V(l, { code: t.code, clientVersion: this.client._clientVersion, meta: u, batchRequestIdx: t.batchRequestIdx });
        } else {
          if (t.isPanic) throw new le(l, this.client._clientVersion);
          if (t instanceof B) throw new B(l, { clientVersion: this.client._clientVersion, batchRequestIdx: t.batchRequestIdx });
          if (t instanceof R) throw new R(l, this.client._clientVersion);
          if (t instanceof le) throw new le(l, this.client._clientVersion);
        }
        throw t.clientVersion = this.client._clientVersion, t;
      }
      sanitizeMessage(t) {
        return this.client._errorFormat && this.client._errorFormat !== "pretty" ? (0, Ol.default)(t) : t;
      }
      unpack(t, r, n) {
        if (!t || (t.data && (t = t.data), !t)) return t;
        let i = Object.keys(t)[0], o = Object.values(t)[0], s = r.filter((u) => u !== "select" && u !== "include"), a = $i(o, s), l = i === "queryRaw" ? Il(a) : Ln(a);
        return n ? n(l) : l;
      }
      get [Symbol.toStringTag]() {
        return "RequestHandler";
      }
    };
    function Em(e) {
      if (e) {
        if (e.kind === "batch") return { kind: "batch", options: { isolationLevel: e.isolationLevel } };
        if (e.kind === "itx") return { kind: "itx", options: kl(e) };
        Fe(e, "Unknown transaction kind");
      }
    }
    function kl(e) {
      return { id: e.id, payload: e.payload };
    }
    function wm(e, t) {
      return Fn(e) && (t == null ? void 0 : t.kind) === "batch" && e.batchRequestIdx !== t.index;
    }
    function xm(e) {
      return e.code === "P2009" || e.code === "P2012";
    }
    function Dl(e) {
      if (e.kind === "Union") return { kind: "Union", errors: e.errors.map(Dl) };
      if (Array.isArray(e.selectionPath)) {
        let [, ...t] = e.selectionPath;
        return __spreadProps(__spreadValues({}, e), { selectionPath: t });
      }
      return e;
    }
    var _l = "5.21.0";
    var Fl = _l;
    var ql = k(no());
    var F = class extends Error {
      constructor(t) {
        super(t + `
Read more at https://pris.ly/d/client-constructor`), this.name = "PrismaClientConstructorValidationError";
      }
      get [Symbol.toStringTag]() {
        return "PrismaClientConstructorValidationError";
      }
    };
    w(F, "PrismaClientConstructorValidationError");
    var Ll = ["datasources", "datasourceUrl", "errorFormat", "adapter", "log", "transactionOptions", "omit", "__internal"];
    var Nl = ["pretty", "colorless", "minimal"];
    var Ml = ["info", "query", "warn", "error"];
    var vm = { datasources: (e, { datasourceNames: t }) => {
      if (e) {
        if (typeof e != "object" || Array.isArray(e)) throw new F(`Invalid value ${JSON.stringify(e)} for "datasources" provided to PrismaClient constructor`);
        for (let [r, n] of Object.entries(e)) {
          if (!t.includes(r)) {
            let i = qt(r, t) || ` Available datasources: ${t.join(", ")}`;
            throw new F(`Unknown datasource ${r} provided to PrismaClient constructor.${i}`);
          }
          if (typeof n != "object" || Array.isArray(n)) throw new F(`Invalid value ${JSON.stringify(e)} for datasource "${r}" provided to PrismaClient constructor.
It should have this form: { url: "CONNECTION_STRING" }`);
          if (n && typeof n == "object") for (let [i, o] of Object.entries(n)) {
            if (i !== "url") throw new F(`Invalid value ${JSON.stringify(e)} for datasource "${r}" provided to PrismaClient constructor.
It should have this form: { url: "CONNECTION_STRING" }`);
            if (typeof o != "string") throw new F(`Invalid value ${JSON.stringify(o)} for datasource "${r}" provided to PrismaClient constructor.
It should have this form: { url: "CONNECTION_STRING" }`);
          }
        }
      }
    }, adapter: (e, t) => {
      if (e === null) return;
      if (e === void 0) throw new F('"adapter" property must not be undefined, use null to conditionally disable driver adapters.');
      if (!In(t).includes("driverAdapters")) throw new F('"adapter" property can only be provided to PrismaClient constructor when "driverAdapters" preview feature is enabled.');
      if (Kt() === "binary") throw new F('Cannot use a driver adapter with the "binary" Query Engine. Please use the "library" Query Engine.');
    }, datasourceUrl: (e) => {
      if (typeof e < "u" && typeof e != "string") throw new F(`Invalid value ${JSON.stringify(e)} for "datasourceUrl" provided to PrismaClient constructor.
Expected string or undefined.`);
    }, errorFormat: (e) => {
      if (e) {
        if (typeof e != "string") throw new F(`Invalid value ${JSON.stringify(e)} for "errorFormat" provided to PrismaClient constructor.`);
        if (!Nl.includes(e)) {
          let t = qt(e, Nl);
          throw new F(`Invalid errorFormat ${e} provided to PrismaClient constructor.${t}`);
        }
      }
    }, log: (e) => {
      if (!e) return;
      if (!Array.isArray(e)) throw new F(`Invalid value ${JSON.stringify(e)} for "log" provided to PrismaClient constructor.`);
      function t(r) {
        if (typeof r == "string" && !Ml.includes(r)) {
          let n = qt(r, Ml);
          throw new F(`Invalid log level "${r}" provided to PrismaClient constructor.${n}`);
        }
      }
      for (let r of e) {
        t(r);
        let n = { level: t, emit: (i) => {
          let o = ["stdout", "event"];
          if (!o.includes(i)) {
            let s = qt(i, o);
            throw new F(`Invalid value ${JSON.stringify(i)} for "emit" in logLevel provided to PrismaClient constructor.${s}`);
          }
        } };
        if (r && typeof r == "object") for (let [i, o] of Object.entries(r)) if (n[i]) n[i](o);
        else throw new F(`Invalid property ${i} for "log" provided to PrismaClient constructor`);
      }
    }, transactionOptions: (e) => {
      if (!e) return;
      let t = e.maxWait;
      if (t != null && t <= 0) throw new F(`Invalid value ${t} for maxWait in "transactionOptions" provided to PrismaClient constructor. maxWait needs to be greater than 0`);
      let r = e.timeout;
      if (r != null && r <= 0) throw new F(`Invalid value ${r} for timeout in "transactionOptions" provided to PrismaClient constructor. timeout needs to be greater than 0`);
    }, omit: (e, t) => {
      if (typeof e != "object") throw new F('"omit" option is expected to be an object.');
      if (e === null) throw new F('"omit" option can not be `null`');
      let r = [];
      for (let [n, i] of Object.entries(e)) {
        let o = Rm(n, t.runtimeDataModel);
        if (!o) {
          r.push({ kind: "UnknownModel", modelKey: n });
          continue;
        }
        for (let [s, a] of Object.entries(i)) {
          let l = o.fields.find((u) => u.name === s);
          if (!l) {
            r.push({ kind: "UnknownField", modelKey: n, fieldName: s });
            continue;
          }
          if (l.relationName) {
            r.push({ kind: "RelationInOmit", modelKey: n, fieldName: s });
            continue;
          }
          typeof a != "boolean" && r.push({ kind: "InvalidFieldValue", modelKey: n, fieldName: s });
        }
      }
      if (r.length > 0) throw new F(Cm(e, r));
    }, __internal: (e) => {
      if (!e) return;
      let t = ["debug", "engine", "configOverride"];
      if (typeof e != "object") throw new F(`Invalid value ${JSON.stringify(e)} for "__internal" to PrismaClient constructor`);
      for (let [r] of Object.entries(e)) if (!t.includes(r)) {
        let n = qt(r, t);
        throw new F(`Invalid property ${JSON.stringify(r)} for "__internal" provided to PrismaClient constructor.${n}`);
      }
    } };
    function jl(e, t) {
      for (let [r, n] of Object.entries(e)) {
        if (!Ll.includes(r)) {
          let i = qt(r, Ll);
          throw new F(`Unknown property ${r} provided to PrismaClient constructor.${i}`);
        }
        vm[r](n, t);
      }
      if (e.datasourceUrl && e.datasources) throw new F('Can not use "datasourceUrl" and "datasources" options at the same time. Pick one of them');
    }
    function qt(e, t) {
      if (t.length === 0 || typeof e != "string") return "";
      let r = Tm(e, t);
      return r ? ` Did you mean "${r}"?` : "";
    }
    function Tm(e, t) {
      if (t.length === 0) return null;
      let r = t.map((i) => ({ value: i, distance: (0, ql.default)(e, i) }));
      r.sort((i, o) => i.distance < o.distance ? -1 : 1);
      let n = r[0];
      return n.distance < 3 ? n.value : null;
    }
    function Rm(e, t) {
      var _a7;
      return (_a7 = $l(t.models, e)) != null ? _a7 : $l(t.types, e);
    }
    function $l(e, t) {
      let r = Object.keys(e).find((n) => Mt(n) === t);
      if (r) return e[r];
    }
    function Cm(e, t) {
      var _a7, _b2, _c2, _d2;
      let r = Ot(e);
      for (let o of t) switch (o.kind) {
        case "UnknownModel":
          (_a7 = r.arguments.getField(o.modelKey)) == null ? void 0 : _a7.markAsError(), r.addErrorMessage(() => `Unknown model name: ${o.modelKey}.`);
          break;
        case "UnknownField":
          (_b2 = r.arguments.getDeepField([o.modelKey, o.fieldName])) == null ? void 0 : _b2.markAsError(), r.addErrorMessage(() => `Model "${o.modelKey}" does not have a field named "${o.fieldName}".`);
          break;
        case "RelationInOmit":
          (_c2 = r.arguments.getDeepField([o.modelKey, o.fieldName])) == null ? void 0 : _c2.markAsError(), r.addErrorMessage(() => 'Relations are already excluded by default and can not be specified in "omit".');
          break;
        case "InvalidFieldValue":
          (_d2 = r.arguments.getDeepFieldValue([o.modelKey, o.fieldName])) == null ? void 0 : _d2.markAsError(), r.addErrorMessage(() => "Omit field option value must be a boolean.");
          break;
      }
      let { message: n, args: i } = yn(r, "colorless");
      return `Error validating "omit" option:

${i}

${n}`;
    }
    function Vl(e) {
      return e.length === 0 ? Promise.resolve([]) : new Promise((t, r) => {
        let n = new Array(e.length), i = null, o = false, s = 0, a = () => {
          o || (s++, s === e.length && (o = true, i ? r(i) : t(n)));
        }, l = (u) => {
          o || (o = true, r(u));
        };
        for (let u = 0; u < e.length; u++) e[u].then((c) => {
          n[u] = c, a();
        }, (c) => {
          if (!Fn(c)) {
            l(c);
            return;
          }
          c.batchRequestIdx === u ? l(c) : (i || (i = c), a());
        });
      });
    }
    var tt = L("prisma:client");
    typeof globalThis == "object" && (globalThis.NODE_CLIENT = true);
    var Sm = { requestArgsToMiddlewareArgs: (e) => e, middlewareArgsToRequestArgs: (e) => e };
    var Am = Symbol.for("prisma.client.transaction.id");
    var Im = { id: 0, nextId() {
      return ++this.id;
    } };
    function Wl(e) {
      class t {
        constructor(n) {
          var _a7, _b2, _c2, _d2, _e2, _f, _g, _h, _i2, _j, _k, _l2, _m, _n2;
          this._originalClient = this;
          this._middlewares = new _n();
          this._createPrismaPromise = lo();
          this.$extends = sa;
          e = (_c2 = (_b2 = (_a7 = n == null ? void 0 : n.__internal) == null ? void 0 : _a7.configOverride) == null ? void 0 : _b2.call(_a7, e)) != null ? _c2 : e, va(e), n && jl(n, e);
          let i = new Ql.EventEmitter().on("error", () => {
          });
          this._extensions = vn.empty(), this._previewFeatures = In(e), this._clientVersion = (_d2 = e.clientVersion) != null ? _d2 : Fl, this._activeProvider = e.activeProvider, this._globalOmit = n == null ? void 0 : n.omit, this._tracingHelper = Rl(this._previewFeatures);
          let o = { rootEnvPath: e.relativeEnvPaths.rootEnvPath && _r.default.resolve(e.dirname, e.relativeEnvPaths.rootEnvPath), schemaEnvPath: e.relativeEnvPaths.schemaEnvPath && _r.default.resolve(e.dirname, e.relativeEnvPaths.schemaEnvPath) }, s;
          if (n == null ? void 0 : n.adapter) {
            s = Ci(n.adapter);
            let l = e.activeProvider === "postgresql" ? "postgres" : e.activeProvider;
            if (s.provider !== l) throw new R(`The Driver Adapter \`${s.adapterName}\`, based on \`${s.provider}\`, is not compatible with the provider \`${l}\` specified in the Prisma schema.`, this._clientVersion);
            if (n.datasources || n.datasourceUrl !== void 0) throw new R("Custom datasource configuration is not compatible with Prisma Driver Adapters. Please define the database connection string directly in the Driver Adapter configuration.", this._clientVersion);
          }
          let a = !s && Ht(o, { conflictCheck: "none" }) || ((_e2 = e.injectableEdgeEnv) == null ? void 0 : _e2.call(e));
          try {
            let l = n != null ? n : {}, u = (_f = l.__internal) != null ? _f : {}, c = u.debug === true;
            c && L.enable("prisma:client");
            let p = _r.default.resolve(e.dirname, e.relativePath);
            Jl.default.existsSync(p) || (p = e.dirname), tt("dirname", e.dirname), tt("relativePath", e.relativePath), tt("cwd", p);
            let d = u.engine || {};
            if (l.errorFormat ? this._errorFormat = l.errorFormat : process.env.NODE_ENV === "production" ? this._errorFormat = "minimal" : process.env.NO_COLOR ? this._errorFormat = "colorless" : this._errorFormat = "colorless", this._runtimeDataModel = e.runtimeDataModel, this._engineConfig = { cwd: p, dirname: e.dirname, enableDebugLogs: c, allowTriggerPanic: d.allowTriggerPanic, datamodelPath: _r.default.join(e.dirname, (_g = e.filename) != null ? _g : "schema.prisma"), prismaPath: (_h = d.binaryPath) != null ? _h : void 0, engineEndpoint: d.endpoint, generator: e.generator, showColors: this._errorFormat === "pretty", logLevel: l.log && Sl(l.log), logQueries: l.log && !!(typeof l.log == "string" ? l.log === "query" : l.log.find((f) => typeof f == "string" ? f === "query" : f.level === "query")), env: (_i2 = a == null ? void 0 : a.parsed) != null ? _i2 : {}, flags: [], engineWasm: e.engineWasm, clientVersion: e.clientVersion, engineVersion: e.engineVersion, previewFeatures: this._previewFeatures, activeProvider: e.activeProvider, inlineSchema: e.inlineSchema, overrideDatasources: Ta(l, e.datasourceNames), inlineDatasources: e.inlineDatasources, inlineSchemaHash: e.inlineSchemaHash, tracingHelper: this._tracingHelper, transactionOptions: { maxWait: (_k = (_j = l.transactionOptions) == null ? void 0 : _j.maxWait) != null ? _k : 2e3, timeout: (_m = (_l2 = l.transactionOptions) == null ? void 0 : _l2.timeout) != null ? _m : 5e3, isolationLevel: (_n2 = l.transactionOptions) == null ? void 0 : _n2.isolationLevel }, logEmitter: i, isBundled: e.isBundled, adapter: s }, this._accelerateEngineConfig = __spreadProps(__spreadValues({}, this._engineConfig), { accelerateUtils: { resolveDatasourceUrl: _t, getBatchRequestPayload: wt, prismaGraphQLToJSError: st, PrismaClientUnknownRequestError: B, PrismaClientInitializationError: R, PrismaClientKnownRequestError: V, debug: L("prisma:client:accelerateEngine"), engineVersion: Ul.version, clientVersion: e.clientVersion } }), tt("clientVersion", e.clientVersion), this._engine = Ya(e, this._engineConfig), this._requestHandler = new Mn(this, i), l.log) for (let f of l.log) {
              let g = typeof f == "string" ? f : f.emit === "stdout" ? f.level : null;
              g && this.$on(g, (h) => {
                var _a8;
                Zt.log(`${(_a8 = Zt.tags[g]) != null ? _a8 : ""}`, h.message || h.query);
              });
            }
            this._metrics = new bt(this._engine);
          } catch (l) {
            throw l.clientVersion = this._clientVersion, l;
          }
          return this._appliedParent = dr(this);
        }
        get [Symbol.toStringTag]() {
          return "PrismaClient";
        }
        $use(n) {
          this._middlewares.use(n);
        }
        $on(n, i) {
          n === "beforeExit" ? this._engine.onBeforeExit(i) : n && this._engineConfig.logEmitter.on(n, i);
        }
        $connect() {
          try {
            return this._engine.start();
          } catch (n) {
            throw n.clientVersion = this._clientVersion, n;
          }
        }
        $disconnect() {
          return __async(this, null, function* () {
            try {
              yield this._engine.stop();
            } catch (n) {
              throw n.clientVersion = this._clientVersion, n;
            } finally {
              Ro();
            }
          });
        }
        $executeRawInternal(n, i, o, s) {
          let a = this._activeProvider;
          return this._request({ action: "executeRaw", args: o, transaction: n, clientMethod: i, argsMapper: ao({ clientMethod: i, activeProvider: a }), callsite: Ze(this._errorFormat), dataPath: [], middlewareArgsMapper: s });
        }
        $executeRaw(n, ...i) {
          return this._createPrismaPromise((o) => {
            if (n.raw !== void 0 || n.sql !== void 0) {
              let [s, a] = Bl(n, i);
              return so(this._activeProvider, s.text, s.values, Array.isArray(n) ? "prisma.$executeRaw`<SQL>`" : "prisma.$executeRaw(sql`<SQL>`)"), this.$executeRawInternal(o, "$executeRaw", s, a);
            }
            throw new J("`$executeRaw` is a tag function, please use it like the following:\n```\nconst result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`\n```\n\nOr read our docs at https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#executeraw\n", { clientVersion: this._clientVersion });
          });
        }
        $executeRawUnsafe(n, ...i) {
          return this._createPrismaPromise((o) => (so(this._activeProvider, n, i, "prisma.$executeRawUnsafe(<SQL>, [...values])"), this.$executeRawInternal(o, "$executeRawUnsafe", [n, ...i])));
        }
        $runCommandRaw(n) {
          if (e.activeProvider !== "mongodb") throw new J(`The ${e.activeProvider} provider does not support $runCommandRaw. Use the mongodb provider.`, { clientVersion: this._clientVersion });
          return this._createPrismaPromise((i) => this._request({ args: n, clientMethod: "$runCommandRaw", dataPath: [], action: "runCommandRaw", argsMapper: ml, callsite: Ze(this._errorFormat), transaction: i }));
        }
        $queryRawInternal(n, i, o, s) {
          return __async(this, null, function* () {
            let a = this._activeProvider;
            return this._request({ action: "queryRaw", args: o, transaction: n, clientMethod: i, argsMapper: ao({ clientMethod: i, activeProvider: a }), callsite: Ze(this._errorFormat), dataPath: [], middlewareArgsMapper: s });
          });
        }
        $queryRaw(n, ...i) {
          return this._createPrismaPromise((o) => {
            if (n.raw !== void 0 || n.sql !== void 0) return this.$queryRawInternal(o, "$queryRaw", ...Bl(n, i));
            throw new J("`$queryRaw` is a tag function, please use it like the following:\n```\nconst result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`\n```\n\nOr read our docs at https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access#queryraw\n", { clientVersion: this._clientVersion });
          });
        }
        $queryRawTyped(n) {
          return this._createPrismaPromise((i) => {
            if (!this._hasPreviewFlag("typedSql")) throw new J("`typedSql` preview feature must be enabled in order to access $queryRawTyped API", { clientVersion: this._clientVersion });
            return this.$queryRawInternal(i, "$queryRawTyped", n);
          });
        }
        $queryRawUnsafe(n, ...i) {
          return this._createPrismaPromise((o) => this.$queryRawInternal(o, "$queryRawUnsafe", [n, ...i]));
        }
        _transactionWithArray({ promises: n, options: i }) {
          let o = Im.nextId(), s = Cl(n.length), a = n.map((l, u) => {
            var _a7, _b2, _c2;
            if ((l == null ? void 0 : l[Symbol.toStringTag]) !== "PrismaPromise") throw new Error("All elements of the array need to be Prisma Client promises. Hint: Please make sure you are not awaiting the Prisma client calls you intended to pass in the $transaction function.");
            let c = (_a7 = i == null ? void 0 : i.isolationLevel) != null ? _a7 : this._engineConfig.transactionOptions.isolationLevel, p = { kind: "batch", id: o, index: u, isolationLevel: c, lock: s };
            return (_c2 = (_b2 = l.requestTransaction) == null ? void 0 : _b2.call(l, p)) != null ? _c2 : l;
          });
          return Vl(a);
        }
        _transactionWithCallback(_0) {
          return __async(this, arguments, function* ({ callback: n, options: i }) {
            var _a7, _b2, _c2;
            let o = { traceparent: this._tracingHelper.getTraceParent() }, s = { maxWait: (_a7 = i == null ? void 0 : i.maxWait) != null ? _a7 : this._engineConfig.transactionOptions.maxWait, timeout: (_b2 = i == null ? void 0 : i.timeout) != null ? _b2 : this._engineConfig.transactionOptions.timeout, isolationLevel: (_c2 = i == null ? void 0 : i.isolationLevel) != null ? _c2 : this._engineConfig.transactionOptions.isolationLevel }, a = yield this._engine.transaction("start", o, s), l;
            try {
              let u = __spreadValues({ kind: "itx" }, a);
              l = yield n(this._createItxClient(u)), yield this._engine.transaction("commit", o, a);
            } catch (u) {
              throw yield this._engine.transaction("rollback", o, a).catch(() => {
              }), u;
            }
            return l;
          });
        }
        _createItxClient(n) {
          return dr(ve(oa(this), [re("_appliedParent", () => this._appliedParent._createItxClient(n)), re("_createPrismaPromise", () => lo(n)), re(Am, () => n.id), Et(El)]));
        }
        $transaction(n, i) {
          var _a7;
          let o;
          typeof n == "function" ? ((_a7 = this._engineConfig.adapter) == null ? void 0 : _a7.adapterName) === "@prisma/adapter-d1" ? o = () => {
            throw new Error("Cloudflare D1 does not support interactive transactions. We recommend you to refactor your queries with that limitation in mind, and use batch transactions with `prisma.$transactions([])` where applicable.");
          } : o = () => this._transactionWithCallback({ callback: n, options: i }) : o = () => this._transactionWithArray({ promises: n, options: i });
          let s = { name: "transaction", attributes: { method: "$transaction" } };
          return this._tracingHelper.runInChildSpan(s, o);
        }
        _request(n) {
          var _a7;
          n.otelParentCtx = this._tracingHelper.getActiveContext();
          let i = (_a7 = n.middlewareArgsMapper) != null ? _a7 : Sm, o = { args: i.requestArgsToMiddlewareArgs(n.args), dataPath: n.dataPath, runInTransaction: !!n.transaction, action: n.action, model: n.model }, s = { middleware: { name: "middleware", middleware: true, attributes: { method: "$use" }, active: false }, operation: { name: "operation", attributes: { method: o.action, model: o.model, name: o.model ? `${o.model}.${o.action}` : o.action } } }, a = -1, l = (u) => __async(this, null, function* () {
            let c = this._middlewares.get(++a);
            if (c) return this._tracingHelper.runInChildSpan(s.middleware, (O) => c(u, (T) => (O == null ? void 0 : O.end(), l(T))));
            let _a8 = u, { runInTransaction: p, args: d } = _a8, f = __objRest(_a8, ["runInTransaction", "args"]), g = __spreadValues(__spreadValues({}, n), f);
            d && (g.args = i.middlewareArgsToRequestArgs(d)), n.transaction !== void 0 && p === false && delete g.transaction;
            let h = yield ma(this, g);
            return g.model ? ua({ result: h, modelName: g.model, args: g.args, extensions: this._extensions, runtimeDataModel: this._runtimeDataModel, globalOmit: this._globalOmit }) : h;
          });
          return this._tracingHelper.runInChildSpan(s.operation, () => new Gl.AsyncResource("prisma-client-request").runInAsyncScope(() => l(o)));
        }
        _executeRequest(_0) {
          return __async(this, arguments, function* ({ args: n, clientMethod: i, dataPath: o, callsite: s, action: a, model: l, argsMapper: u, transaction: c, unpacker: p, otelParentCtx: d, customDataProxyFetch: f }) {
            try {
              n = u ? u(n) : n;
              let g = { name: "serialize" }, h = this._tracingHelper.runInChildSpan(g, () => cl({ modelName: l, runtimeDataModel: this._runtimeDataModel, action: a, args: n, clientMethod: i, callsite: s, extensions: this._extensions, errorFormat: this._errorFormat, clientVersion: this._clientVersion, previewFeatures: this._previewFeatures, globalOmit: this._globalOmit }));
              return L.enabled("prisma:client") && (tt("Prisma Client call:"), tt(`prisma.${i}(${Vs(n)})`), tt("Generated request:"), tt(JSON.stringify(h, null, 2) + `
`)), (c == null ? void 0 : c.kind) === "batch" && (yield c.lock), this._requestHandler.request({ protocolQuery: h, modelName: l, action: a, clientMethod: i, dataPath: o, callsite: s, args: n, extensions: this._extensions, transaction: c, unpacker: p, otelParentCtx: d, otelChildCtx: this._tracingHelper.getActiveContext(), globalOmit: this._globalOmit, customDataProxyFetch: f });
            } catch (g) {
              throw g.clientVersion = this._clientVersion, g;
            }
          });
        }
        get $metrics() {
          if (!this._hasPreviewFlag("metrics")) throw new J("`metrics` preview feature must be enabled in order to access metrics API", { clientVersion: this._clientVersion });
          return this._metrics;
        }
        _hasPreviewFlag(n) {
          var _a7;
          return !!((_a7 = this._engineConfig.previewFeatures) == null ? void 0 : _a7.includes(n));
        }
        $applyPendingMigrations() {
          return this._engine.applyPendingMigrations();
        }
      }
      return t;
    }
    function Bl(e, t) {
      return Om(e) ? [new ie(e, t), xl] : [e, Pl];
    }
    function Om(e) {
      return Array.isArray(e) && Array.isArray(e.raw);
    }
    var km = /* @__PURE__ */ new Set(["toJSON", "$$typeof", "asymmetricMatch", Symbol.iterator, Symbol.toStringTag, Symbol.isConcatSpreadable, Symbol.toPrimitive]);
    function Hl(e) {
      return new Proxy(e, { get(t, r) {
        if (r in t) return t[r];
        if (!km.has(r)) throw new TypeError(`Invalid enum value: ${String(r)}`);
      } });
    }
    function Kl(e) {
      Ht(e, { conflictCheck: "warn" });
    }
  }
});

// ../../packages/prisma/dist/index.js
var require_dist = __commonJS({
  "../../packages/prisma/dist/index.js"(exports2) {
    Object.defineProperty(exports2, "__esModule", { value: true });
    var {
      PrismaClientKnownRequestError: PrismaClientKnownRequestError2,
      PrismaClientUnknownRequestError: PrismaClientUnknownRequestError2,
      PrismaClientRustPanicError: PrismaClientRustPanicError2,
      PrismaClientInitializationError: PrismaClientInitializationError2,
      PrismaClientValidationError: PrismaClientValidationError2,
      NotFoundError: NotFoundError2,
      getPrismaClient: getPrismaClient3,
      sqltag: sqltag2,
      empty: empty2,
      join: join2,
      raw: raw2,
      skip: skip2,
      Decimal: Decimal2,
      Debug: Debug2,
      objectEnumValues: objectEnumValues2,
      makeStrictEnum: makeStrictEnum2,
      Extensions: Extensions2,
      warnOnce: warnOnce2,
      defineDmmfProperty: defineDmmfProperty2,
      Public: Public2,
      getRuntime: getRuntime2
    } = require_library();
    var Prisma = {};
    exports2.Prisma = Prisma;
    exports2.$Enums = {};
    Prisma.prismaVersion = {
      client: "5.21.0",
      engine: "08713a93b99d58f31485621c634b04983ae01d95"
    };
    Prisma.PrismaClientKnownRequestError = PrismaClientKnownRequestError2;
    Prisma.PrismaClientUnknownRequestError = PrismaClientUnknownRequestError2;
    Prisma.PrismaClientRustPanicError = PrismaClientRustPanicError2;
    Prisma.PrismaClientInitializationError = PrismaClientInitializationError2;
    Prisma.PrismaClientValidationError = PrismaClientValidationError2;
    Prisma.NotFoundError = NotFoundError2;
    Prisma.Decimal = Decimal2;
    Prisma.sql = sqltag2;
    Prisma.empty = empty2;
    Prisma.join = join2;
    Prisma.raw = raw2;
    Prisma.validator = Public2.validator;
    Prisma.getExtensionContext = Extensions2.getExtensionContext;
    Prisma.defineExtension = Extensions2.defineExtension;
    Prisma.DbNull = objectEnumValues2.instances.DbNull;
    Prisma.JsonNull = objectEnumValues2.instances.JsonNull;
    Prisma.AnyNull = objectEnumValues2.instances.AnyNull;
    Prisma.NullTypes = {
      DbNull: objectEnumValues2.classes.DbNull,
      JsonNull: objectEnumValues2.classes.JsonNull,
      AnyNull: objectEnumValues2.classes.AnyNull
    };
    var path = require("path");
    exports2.Prisma.TransactionIsolationLevel = makeStrictEnum2({
      ReadUncommitted: "ReadUncommitted",
      ReadCommitted: "ReadCommitted",
      RepeatableRead: "RepeatableRead",
      Serializable: "Serializable"
    });
    exports2.Prisma.ParticipantAnalyticsScalarFieldEnum = {
      id: "id",
      type: "type",
      timestamp: "timestamp",
      trialsCount: "trialsCount",
      responseCount: "responseCount",
      totalScore: "totalScore",
      totalPoints: "totalPoints",
      totalXp: "totalXp",
      meanCorrectCount: "meanCorrectCount",
      meanPartialCorrectCount: "meanPartialCorrectCount",
      meanWrongCount: "meanWrongCount",
      meanFirstCorrectCount: "meanFirstCorrectCount",
      meanLastCorrectCount: "meanLastCorrectCount",
      collectedAchievements: "collectedAchievements",
      participantId: "participantId",
      courseId: "courseId"
    };
    exports2.Prisma.AggregatedAnalyticsScalarFieldEnum = {
      id: "id",
      type: "type",
      timestamp: "timestamp",
      responseCount: "responseCount",
      participantCount: "participantCount",
      totalScore: "totalScore",
      totalPoints: "totalPoints",
      totalXp: "totalXp",
      totalElementsAvailable: "totalElementsAvailable",
      courseId: "courseId"
    };
    exports2.Prisma.CompetencyAnalyticsScalarFieldEnum = {
      id: "id",
      unsolvedQuestionsCount: "unsolvedQuestionsCount",
      lastCorrectCount: "lastCorrectCount",
      lastPartialCorrectCount: "lastPartialCorrectCount",
      lastWrongCount: "lastWrongCount",
      competencyId: "competencyId",
      participantAnalyticsId: "participantAnalyticsId"
    };
    exports2.Prisma.AggregatedCompetencyAnalyticsScalarFieldEnum = {
      id: "id",
      meanUnsolvedQuestionsCount: "meanUnsolvedQuestionsCount",
      meanLastCorrectCount: "meanLastCorrectCount",
      meanLastPartialCorrectCount: "meanLastPartialCorrectCount",
      meanLastWrongCount: "meanLastWrongCount",
      competencyId: "competencyId",
      aggregatedAnalyticsId: "aggregatedAnalyticsId"
    };
    exports2.Prisma.ParticipantCourseAnalyticsScalarFieldEnum = {
      id: "id",
      activeWeeks: "activeWeeks",
      activeDaysPerWeek: "activeDaysPerWeek",
      meanElementsPerDay: "meanElementsPerDay",
      activityLevel: "activityLevel",
      courseId: "courseId",
      participantId: "participantId"
    };
    exports2.Prisma.AggregatedCourseAnalyticsScalarFieldEnum = {
      id: "id",
      participantCount: "participantCount",
      activityMonday: "activityMonday",
      activityTuesday: "activityTuesday",
      activityWednesday: "activityWednesday",
      activityThursday: "activityThursday",
      activityFriday: "activityFriday",
      activitySaturday: "activitySaturday",
      activitySunday: "activitySunday",
      courseId: "courseId"
    };
    exports2.Prisma.CompetencyTreeScalarFieldEnum = {
      id: "id",
      name: "name",
      description: "description",
      ownerId: "ownerId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.CompetencyScalarFieldEnum = {
      id: "id",
      name: "name",
      description: "description",
      lft: "lft",
      rgt: "rgt",
      treeId: "treeId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.CourseScalarFieldEnum = {
      id: "id",
      isArchived: "isArchived",
      pinCode: "pinCode",
      name: "name",
      displayName: "displayName",
      description: "description",
      color: "color",
      startDate: "startDate",
      endDate: "endDate",
      notificationEmail: "notificationEmail",
      isGamificationEnabled: "isGamificationEnabled",
      areAnalyticsValid: "areAnalyticsValid",
      isGroupCreationEnabled: "isGroupCreationEnabled",
      groupDeadlineDate: "groupDeadlineDate",
      preferredGroupSize: "preferredGroupSize",
      maxGroupSize: "maxGroupSize",
      randomAssignmentFinalized: "randomAssignmentFinalized",
      competencyTreeId: "competencyTreeId",
      ownerId: "ownerId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ElementScalarFieldEnum = {
      id: "id",
      version: "version",
      originalId: "originalId",
      isArchived: "isArchived",
      isDeleted: "isDeleted",
      name: "name",
      content: "content",
      explanation: "explanation",
      pointsMultiplier: "pointsMultiplier",
      options: "options",
      status: "status",
      type: "type",
      ownerId: "ownerId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ElementInstanceScalarFieldEnum = {
      id: "id",
      originalId: "originalId",
      migrationId: "migrationId",
      type: "type",
      elementType: "elementType",
      order: "order",
      options: "options",
      elementData: "elementData",
      results: "results",
      anonymousResults: "anonymousResults",
      elementId: "elementId",
      elementStackId: "elementStackId",
      ownerId: "ownerId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.InstanceStatisticsScalarFieldEnum = {
      anonymousCorrectCount: "anonymousCorrectCount",
      anonymousPartialCorrectCount: "anonymousPartialCorrectCount",
      anonymousWrongCount: "anonymousWrongCount",
      upvoteCount: "upvoteCount",
      downvoteCount: "downvoteCount",
      correctCount: "correctCount",
      partialCorrectCount: "partialCorrectCount",
      wrongCount: "wrongCount",
      firstCorrectCount: "firstCorrectCount",
      firstPartialCorrectCount: "firstPartialCorrectCount",
      firstWrongCount: "firstWrongCount",
      lastCorrectCount: "lastCorrectCount",
      lastPartialCorrectCount: "lastPartialCorrectCount",
      lastWrongCount: "lastWrongCount",
      uniqueParticipantCount: "uniqueParticipantCount",
      averageTimeSpent: "averageTimeSpent",
      elementInstanceId: "elementInstanceId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ElementStackScalarFieldEnum = {
      id: "id",
      originalId: "originalId",
      type: "type",
      order: "order",
      displayName: "displayName",
      description: "description",
      options: "options",
      practiceQuizId: "practiceQuizId",
      microLearningId: "microLearningId",
      liveQuizId: "liveQuizId",
      groupActivityId: "groupActivityId",
      courseId: "courseId"
    };
    exports2.Prisma.QuestionInstanceScalarFieldEnum = {
      id: "id",
      originalId: "originalId",
      type: "type",
      order: "order",
      participants: "participants",
      pointsMultiplier: "pointsMultiplier",
      resetTimeDays: "resetTimeDays",
      maxBonusPoints: "maxBonusPoints",
      timeToZeroBonus: "timeToZeroBonus",
      questionData: "questionData",
      results: "results",
      sessionBlockId: "sessionBlockId",
      questionId: "questionId",
      ownerId: "ownerId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.TagScalarFieldEnum = {
      id: "id",
      name: "name",
      order: "order",
      originalId: "originalId",
      ownerId: "ownerId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.MediaFileScalarFieldEnum = {
      id: "id",
      href: "href",
      name: "name",
      type: "type",
      description: "description",
      originalId: "originalId",
      ownerId: "ownerId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.TitleScalarFieldEnum = {
      id: "id",
      name: "name",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.AchievementScalarFieldEnum = {
      id: "id",
      name: "name",
      description: "description",
      nameDE: "nameDE",
      descriptionDE: "descriptionDE",
      nameEN: "nameEN",
      descriptionEN: "descriptionEN",
      icon: "icon",
      iconColor: "iconColor",
      rewardedPoints: "rewardedPoints",
      rewardedXP: "rewardedXP",
      type: "type",
      scope: "scope",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ParticipantAchievementInstanceScalarFieldEnum = {
      id: "id",
      achievedAt: "achievedAt",
      achievedCount: "achievedCount",
      achievementId: "achievementId",
      participantId: "participantId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.GroupAchievementInstanceScalarFieldEnum = {
      id: "id",
      achievedAt: "achievedAt",
      achievedCount: "achievedCount",
      achievementId: "achievementId",
      groupId: "groupId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ClassAchievementInstanceScalarFieldEnum = {
      id: "id",
      achievedAt: "achievedAt",
      achievedCount: "achievedCount",
      achievementId: "achievementId",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.AwardEntryScalarFieldEnum = {
      id: "id",
      order: "order",
      type: "type",
      name: "name",
      displayName: "displayName",
      description: "description",
      courseId: "courseId",
      participantId: "participantId",
      participantGroupId: "participantGroupId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.LevelScalarFieldEnum = {
      id: "id",
      index: "index",
      name: "name",
      requiredXp: "requiredXp",
      avatar: "avatar",
      nextLevelIx: "nextLevelIx"
    };
    exports2.Prisma.MigrationScalarFieldEnum = {
      id: "id",
      createdAt: "createdAt"
    };
    exports2.Prisma.EmailTemplateScalarFieldEnum = {
      name: "name",
      html: "html",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ParticipantAccountScalarFieldEnum = {
      id: "id",
      ssoId: "ssoId",
      ssoType: "ssoType",
      participantId: "participantId",
      createdAt: "createdAt"
    };
    exports2.Prisma.ParticipantScalarFieldEnum = {
      id: "id",
      email: "email",
      isEmailValid: "isEmailValid",
      username: "username",
      password: "password",
      avatar: "avatar",
      xp: "xp",
      avatarSettings: "avatarSettings",
      isActive: "isActive",
      isProfilePublic: "isProfilePublic",
      isSSOAccount: "isSSOAccount",
      lastLoginAt: "lastLoginAt",
      locale: "locale",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ParticipantGroupScalarFieldEnum = {
      id: "id",
      name: "name",
      code: "code",
      groupActivityScore: "groupActivityScore",
      averageMemberScore: "averageMemberScore",
      courseId: "courseId",
      randomlyAssigned: "randomlyAssigned",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.GroupMessageScalarFieldEnum = {
      id: "id",
      content: "content",
      groupId: "groupId",
      participantId: "participantId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ParticipationScalarFieldEnum = {
      id: "id",
      isActive: "isActive",
      courseId: "courseId",
      participantId: "participantId",
      courseLeaderboardId: "courseLeaderboardId",
      completedMicroLearnings: "completedMicroLearnings",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.GroupAssignmentPoolEntryScalarFieldEnum = {
      id: "id",
      courseId: "courseId",
      participantId: "participantId",
      createdAt: "createdAt"
    };
    exports2.Prisma.LeaderboardEntryScalarFieldEnum = {
      id: "id",
      type: "type",
      score: "score",
      participantId: "participantId",
      sessionParticipationId: "sessionParticipationId",
      sessionId: "sessionId",
      liveQuizId: "liveQuizId",
      courseId: "courseId"
    };
    exports2.Prisma.PushSubscriptionScalarFieldEnum = {
      id: "id",
      endpoint: "endpoint",
      expirationTime: "expirationTime",
      p256dh: "p256dh",
      auth: "auth",
      courseId: "courseId",
      participationId: "participationId",
      participantId: "participantId",
      createdAt: "createdAt"
    };
    exports2.Prisma.PracticeQuizScalarFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      description: "description",
      pointsMultiplier: "pointsMultiplier",
      resetTimeDays: "resetTimeDays",
      orderType: "orderType",
      status: "status",
      availableFrom: "availableFrom",
      isDeleted: "isDeleted",
      startedCount: "startedCount",
      completedCount: "completedCount",
      repeatedCount: "repeatedCount",
      ownerId: "ownerId",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.SessionBlockScalarFieldEnum = {
      id: "id",
      originalId: "originalId",
      order: "order",
      status: "status",
      expiresAt: "expiresAt",
      timeLimit: "timeLimit",
      randomSelection: "randomSelection",
      execution: "execution",
      sessionId: "sessionId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.LiveSessionScalarFieldEnum = {
      id: "id",
      originalId: "originalId",
      isLiveQAEnabled: "isLiveQAEnabled",
      isConfusionFeedbackEnabled: "isConfusionFeedbackEnabled",
      isModerationEnabled: "isModerationEnabled",
      isGamificationEnabled: "isGamificationEnabled",
      isDeleted: "isDeleted",
      namespace: "namespace",
      pinCode: "pinCode",
      name: "name",
      displayName: "displayName",
      description: "description",
      startedAt: "startedAt",
      finishedAt: "finishedAt",
      linkTo: "linkTo",
      pointsMultiplier: "pointsMultiplier",
      maxBonusPoints: "maxBonusPoints",
      timeToZeroBonus: "timeToZeroBonus",
      accessMode: "accessMode",
      status: "status",
      activeBlockId: "activeBlockId",
      ownerId: "ownerId",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.LiveQuizScalarFieldEnum = {
      id: "id",
      originalId: "originalId",
      isLiveQAEnabled: "isLiveQAEnabled",
      isConfusionFeedbackEnabled: "isConfusionFeedbackEnabled",
      isModerationEnabled: "isModerationEnabled",
      isGamificationEnabled: "isGamificationEnabled",
      isDeleted: "isDeleted",
      namespace: "namespace",
      pinCode: "pinCode",
      name: "name",
      displayName: "displayName",
      description: "description",
      startedAt: "startedAt",
      finishedAt: "finishedAt",
      pointsMultiplier: "pointsMultiplier",
      maxBonusPoints: "maxBonusPoints",
      timeToZeroBonus: "timeToZeroBonus",
      accessMode: "accessMode",
      status: "status",
      activeStackId: "activeStackId",
      ownerId: "ownerId",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.MicroLearningScalarFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      pointsMultiplier: "pointsMultiplier",
      description: "description",
      status: "status",
      scheduledStartAt: "scheduledStartAt",
      scheduledEndAt: "scheduledEndAt",
      arePushNotificationsSent: "arePushNotificationsSent",
      isDeleted: "isDeleted",
      startedCount: "startedCount",
      completedCount: "completedCount",
      ownerId: "ownerId",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.GroupActivityParameterScalarFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      type: "type",
      options: "options",
      unit: "unit",
      groupActivityId: "groupActivityId"
    };
    exports2.Prisma.GroupActivityClueScalarFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      type: "type",
      value: "value",
      unit: "unit",
      groupActivityId: "groupActivityId"
    };
    exports2.Prisma.GroupActivityClueInstanceScalarFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      type: "type",
      value: "value",
      unit: "unit",
      groupActivityInstanceId: "groupActivityInstanceId"
    };
    exports2.Prisma.GroupActivityScalarFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      status: "status",
      pointsMultiplier: "pointsMultiplier",
      description: "description",
      scheduledStartAt: "scheduledStartAt",
      scheduledEndAt: "scheduledEndAt",
      isDeleted: "isDeleted",
      ownerId: "ownerId",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.GroupActivityClueAssignmentScalarFieldEnum = {
      id: "id",
      groupActivityClueInstanceId: "groupActivityClueInstanceId",
      groupActivityInstanceId: "groupActivityInstanceId",
      participantId: "participantId"
    };
    exports2.Prisma.GroupActivityInstanceScalarFieldEnum = {
      id: "id",
      decisions: "decisions",
      decisionsSubmittedAt: "decisionsSubmittedAt",
      results: "results",
      resultsComputedAt: "resultsComputedAt",
      groupActivityId: "groupActivityId",
      groupId: "groupId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.FeedbackScalarFieldEnum = {
      id: "id",
      isPublished: "isPublished",
      isPinned: "isPinned",
      isResolved: "isResolved",
      content: "content",
      votes: "votes",
      resolvedAt: "resolvedAt",
      sessionId: "sessionId",
      liveQuizId: "liveQuizId",
      participantId: "participantId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.FeedbackResponseScalarFieldEnum = {
      id: "id",
      content: "content",
      positiveReactions: "positiveReactions",
      negativeReactions: "negativeReactions",
      feedbackId: "feedbackId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ConfusionTimestepScalarFieldEnum = {
      id: "id",
      difficulty: "difficulty",
      speed: "speed",
      sessionId: "sessionId",
      liveQuizId: "liveQuizId",
      createdAt: "createdAt"
    };
    exports2.Prisma.QuestionResponseScalarFieldEnum = {
      id: "id",
      trialsCount: "trialsCount",
      totalScore: "totalScore",
      totalPointsAwarded: "totalPointsAwarded",
      totalXpAwarded: "totalXpAwarded",
      averageTimeSpent: "averageTimeSpent",
      lastAwardedAt: "lastAwardedAt",
      lastXpAwardedAt: "lastXpAwardedAt",
      lastAnsweredAt: "lastAnsweredAt",
      correctCount: "correctCount",
      correctCountStreak: "correctCountStreak",
      lastCorrectAt: "lastCorrectAt",
      partialCorrectCount: "partialCorrectCount",
      lastPartialCorrectAt: "lastPartialCorrectAt",
      wrongCount: "wrongCount",
      lastWrongAt: "lastWrongAt",
      eFactor: "eFactor",
      interval: "interval",
      nextDueAt: "nextDueAt",
      firstResponse: "firstResponse",
      firstResponseCorrectness: "firstResponseCorrectness",
      lastResponse: "lastResponse",
      lastResponseCorrectness: "lastResponseCorrectness",
      aggregatedResponses: "aggregatedResponses",
      participantId: "participantId",
      participationId: "participationId",
      elementInstanceId: "elementInstanceId",
      practiceQuizId: "practiceQuizId",
      microLearningId: "microLearningId",
      courseId: "courseId",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      isMigrated: "isMigrated"
    };
    exports2.Prisma.QuestionResponseDetailScalarFieldEnum = {
      id: "id",
      score: "score",
      pointsAwarded: "pointsAwarded",
      xpAwarded: "xpAwarded",
      timeSpent: "timeSpent",
      response: "response",
      participantId: "participantId",
      participationId: "participationId",
      elementInstanceId: "elementInstanceId",
      practiceQuizId: "practiceQuizId",
      microLearningId: "microLearningId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.ElementFeedbackScalarFieldEnum = {
      id: "id",
      upvote: "upvote",
      downvote: "downvote",
      feedback: "feedback",
      participantId: "participantId",
      elementInstanceId: "elementInstanceId",
      elementId: "elementId",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.AccountScalarFieldEnum = {
      id: "id",
      type: "type",
      provider: "provider",
      providerAccountId: "providerAccountId",
      refresh_token: "refresh_token",
      access_token: "access_token",
      expires_at: "expires_at",
      token_type: "token_type",
      scope: "scope",
      id_token: "id_token",
      session_state: "session_state",
      userId: "userId"
    };
    exports2.Prisma.SessionScalarFieldEnum = {
      id: "id",
      sessionToken: "sessionToken",
      expires: "expires",
      userId: "userId"
    };
    exports2.Prisma.VerificationTokenScalarFieldEnum = {
      identifier: "identifier",
      token: "token",
      expires: "expires"
    };
    exports2.Prisma.UserLoginScalarFieldEnum = {
      id: "id",
      name: "name",
      password: "password",
      scope: "scope",
      lastLoginAt: "lastLoginAt",
      userId: "userId"
    };
    exports2.Prisma.UserScalarFieldEnum = {
      id: "id",
      originalId: "originalId",
      name: "name",
      email: "email",
      emailVerified: "emailVerified",
      sendProjectUpdates: "sendProjectUpdates",
      image: "image",
      shortname: "shortname",
      lastLoginAt: "lastLoginAt",
      deletionToken: "deletionToken",
      deletionRequestedAt: "deletionRequestedAt",
      loginToken: "loginToken",
      loginTokenExpiresAt: "loginTokenExpiresAt",
      locale: "locale",
      role: "role",
      catalystInstitutional: "catalystInstitutional",
      catalystIndividual: "catalystIndividual",
      catalystTier: "catalystTier",
      firstLogin: "firstLogin",
      createdAt: "createdAt",
      updatedAt: "updatedAt"
    };
    exports2.Prisma.SortOrder = {
      asc: "asc",
      desc: "desc"
    };
    exports2.Prisma.JsonNullValueInput = {
      JsonNull: Prisma.JsonNull
    };
    exports2.Prisma.NullableJsonNullValueInput = {
      DbNull: Prisma.DbNull,
      JsonNull: Prisma.JsonNull
    };
    exports2.Prisma.QueryMode = {
      default: "default",
      insensitive: "insensitive"
    };
    exports2.Prisma.ParticipantAnalyticsOrderByRelevanceFieldEnum = {
      collectedAchievements: "collectedAchievements",
      participantId: "participantId",
      courseId: "courseId"
    };
    exports2.Prisma.AggregatedAnalyticsOrderByRelevanceFieldEnum = {
      courseId: "courseId"
    };
    exports2.Prisma.ParticipantCourseAnalyticsOrderByRelevanceFieldEnum = {
      courseId: "courseId",
      participantId: "participantId"
    };
    exports2.Prisma.AggregatedCourseAnalyticsOrderByRelevanceFieldEnum = {
      courseId: "courseId"
    };
    exports2.Prisma.NullsOrder = {
      first: "first",
      last: "last"
    };
    exports2.Prisma.CompetencyTreeOrderByRelevanceFieldEnum = {
      name: "name",
      description: "description",
      ownerId: "ownerId"
    };
    exports2.Prisma.CompetencyOrderByRelevanceFieldEnum = {
      name: "name",
      description: "description"
    };
    exports2.Prisma.CourseOrderByRelevanceFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      description: "description",
      color: "color",
      notificationEmail: "notificationEmail",
      ownerId: "ownerId"
    };
    exports2.Prisma.JsonNullValueFilter = {
      DbNull: Prisma.DbNull,
      JsonNull: Prisma.JsonNull,
      AnyNull: Prisma.AnyNull
    };
    exports2.Prisma.ElementOrderByRelevanceFieldEnum = {
      originalId: "originalId",
      name: "name",
      content: "content",
      explanation: "explanation",
      ownerId: "ownerId"
    };
    exports2.Prisma.ElementInstanceOrderByRelevanceFieldEnum = {
      originalId: "originalId",
      migrationId: "migrationId",
      ownerId: "ownerId"
    };
    exports2.Prisma.ElementStackOrderByRelevanceFieldEnum = {
      originalId: "originalId",
      displayName: "displayName",
      description: "description",
      practiceQuizId: "practiceQuizId",
      microLearningId: "microLearningId",
      liveQuizId: "liveQuizId",
      groupActivityId: "groupActivityId",
      courseId: "courseId"
    };
    exports2.Prisma.QuestionInstanceOrderByRelevanceFieldEnum = {
      originalId: "originalId",
      ownerId: "ownerId"
    };
    exports2.Prisma.TagOrderByRelevanceFieldEnum = {
      name: "name",
      originalId: "originalId",
      ownerId: "ownerId"
    };
    exports2.Prisma.MediaFileOrderByRelevanceFieldEnum = {
      id: "id",
      href: "href",
      name: "name",
      type: "type",
      description: "description",
      originalId: "originalId",
      ownerId: "ownerId"
    };
    exports2.Prisma.TitleOrderByRelevanceFieldEnum = {
      name: "name",
      courseId: "courseId"
    };
    exports2.Prisma.AchievementOrderByRelevanceFieldEnum = {
      name: "name",
      description: "description",
      nameDE: "nameDE",
      descriptionDE: "descriptionDE",
      nameEN: "nameEN",
      descriptionEN: "descriptionEN",
      icon: "icon",
      iconColor: "iconColor",
      courseId: "courseId"
    };
    exports2.Prisma.ParticipantAchievementInstanceOrderByRelevanceFieldEnum = {
      participantId: "participantId"
    };
    exports2.Prisma.GroupAchievementInstanceOrderByRelevanceFieldEnum = {
      groupId: "groupId"
    };
    exports2.Prisma.ClassAchievementInstanceOrderByRelevanceFieldEnum = {
      courseId: "courseId"
    };
    exports2.Prisma.AwardEntryOrderByRelevanceFieldEnum = {
      name: "name",
      displayName: "displayName",
      description: "description",
      courseId: "courseId",
      participantId: "participantId",
      participantGroupId: "participantGroupId"
    };
    exports2.Prisma.LevelOrderByRelevanceFieldEnum = {
      name: "name",
      avatar: "avatar"
    };
    exports2.Prisma.MigrationOrderByRelevanceFieldEnum = {
      id: "id"
    };
    exports2.Prisma.EmailTemplateOrderByRelevanceFieldEnum = {
      name: "name",
      html: "html"
    };
    exports2.Prisma.ParticipantAccountOrderByRelevanceFieldEnum = {
      id: "id",
      ssoId: "ssoId",
      ssoType: "ssoType",
      participantId: "participantId"
    };
    exports2.Prisma.ParticipantOrderByRelevanceFieldEnum = {
      id: "id",
      email: "email",
      username: "username",
      password: "password",
      avatar: "avatar"
    };
    exports2.Prisma.ParticipantGroupOrderByRelevanceFieldEnum = {
      id: "id",
      name: "name",
      courseId: "courseId"
    };
    exports2.Prisma.GroupMessageOrderByRelevanceFieldEnum = {
      content: "content",
      groupId: "groupId",
      participantId: "participantId"
    };
    exports2.Prisma.ParticipationOrderByRelevanceFieldEnum = {
      courseId: "courseId",
      participantId: "participantId",
      completedMicroLearnings: "completedMicroLearnings"
    };
    exports2.Prisma.GroupAssignmentPoolEntryOrderByRelevanceFieldEnum = {
      courseId: "courseId",
      participantId: "participantId"
    };
    exports2.Prisma.LeaderboardEntryOrderByRelevanceFieldEnum = {
      participantId: "participantId",
      sessionId: "sessionId",
      liveQuizId: "liveQuizId",
      courseId: "courseId"
    };
    exports2.Prisma.PushSubscriptionOrderByRelevanceFieldEnum = {
      endpoint: "endpoint",
      p256dh: "p256dh",
      auth: "auth",
      courseId: "courseId",
      participantId: "participantId"
    };
    exports2.Prisma.PracticeQuizOrderByRelevanceFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      description: "description",
      ownerId: "ownerId",
      courseId: "courseId"
    };
    exports2.Prisma.SessionBlockOrderByRelevanceFieldEnum = {
      originalId: "originalId",
      sessionId: "sessionId"
    };
    exports2.Prisma.LiveSessionOrderByRelevanceFieldEnum = {
      id: "id",
      originalId: "originalId",
      namespace: "namespace",
      name: "name",
      displayName: "displayName",
      description: "description",
      linkTo: "linkTo",
      ownerId: "ownerId",
      courseId: "courseId"
    };
    exports2.Prisma.LiveQuizOrderByRelevanceFieldEnum = {
      id: "id",
      originalId: "originalId",
      namespace: "namespace",
      name: "name",
      displayName: "displayName",
      description: "description",
      ownerId: "ownerId",
      courseId: "courseId"
    };
    exports2.Prisma.MicroLearningOrderByRelevanceFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      description: "description",
      ownerId: "ownerId",
      courseId: "courseId"
    };
    exports2.Prisma.GroupActivityParameterOrderByRelevanceFieldEnum = {
      name: "name",
      displayName: "displayName",
      options: "options",
      unit: "unit",
      groupActivityId: "groupActivityId"
    };
    exports2.Prisma.GroupActivityClueOrderByRelevanceFieldEnum = {
      name: "name",
      displayName: "displayName",
      value: "value",
      unit: "unit",
      groupActivityId: "groupActivityId"
    };
    exports2.Prisma.GroupActivityClueInstanceOrderByRelevanceFieldEnum = {
      name: "name",
      displayName: "displayName",
      value: "value",
      unit: "unit"
    };
    exports2.Prisma.GroupActivityOrderByRelevanceFieldEnum = {
      id: "id",
      name: "name",
      displayName: "displayName",
      description: "description",
      ownerId: "ownerId",
      courseId: "courseId"
    };
    exports2.Prisma.GroupActivityClueAssignmentOrderByRelevanceFieldEnum = {
      participantId: "participantId"
    };
    exports2.Prisma.GroupActivityInstanceOrderByRelevanceFieldEnum = {
      groupActivityId: "groupActivityId",
      groupId: "groupId"
    };
    exports2.Prisma.FeedbackOrderByRelevanceFieldEnum = {
      content: "content",
      sessionId: "sessionId",
      liveQuizId: "liveQuizId",
      participantId: "participantId"
    };
    exports2.Prisma.FeedbackResponseOrderByRelevanceFieldEnum = {
      content: "content"
    };
    exports2.Prisma.ConfusionTimestepOrderByRelevanceFieldEnum = {
      sessionId: "sessionId",
      liveQuizId: "liveQuizId"
    };
    exports2.Prisma.QuestionResponseOrderByRelevanceFieldEnum = {
      participantId: "participantId",
      practiceQuizId: "practiceQuizId",
      microLearningId: "microLearningId",
      courseId: "courseId"
    };
    exports2.Prisma.QuestionResponseDetailOrderByRelevanceFieldEnum = {
      participantId: "participantId",
      practiceQuizId: "practiceQuizId",
      microLearningId: "microLearningId"
    };
    exports2.Prisma.ElementFeedbackOrderByRelevanceFieldEnum = {
      feedback: "feedback",
      participantId: "participantId"
    };
    exports2.Prisma.AccountOrderByRelevanceFieldEnum = {
      id: "id",
      type: "type",
      provider: "provider",
      providerAccountId: "providerAccountId",
      refresh_token: "refresh_token",
      access_token: "access_token",
      token_type: "token_type",
      scope: "scope",
      id_token: "id_token",
      session_state: "session_state",
      userId: "userId"
    };
    exports2.Prisma.SessionOrderByRelevanceFieldEnum = {
      id: "id",
      sessionToken: "sessionToken",
      userId: "userId"
    };
    exports2.Prisma.VerificationTokenOrderByRelevanceFieldEnum = {
      identifier: "identifier",
      token: "token"
    };
    exports2.Prisma.UserLoginOrderByRelevanceFieldEnum = {
      id: "id",
      name: "name",
      password: "password",
      userId: "userId"
    };
    exports2.Prisma.UserOrderByRelevanceFieldEnum = {
      id: "id",
      originalId: "originalId",
      name: "name",
      email: "email",
      image: "image",
      shortname: "shortname",
      deletionToken: "deletionToken",
      loginToken: "loginToken",
      catalystTier: "catalystTier"
    };
    exports2.AnalyticsType = exports2.$Enums.AnalyticsType = {
      DAILY: "DAILY",
      WEEKLY: "WEEKLY",
      MONTHLY: "MONTHLY",
      COURSE: "COURSE"
    };
    exports2.ActivityLevel = exports2.$Enums.ActivityLevel = {
      LOW: "LOW",
      MEDIUM: "MEDIUM",
      HIGH: "HIGH"
    };
    exports2.ElementStatus = exports2.$Enums.ElementStatus = {
      DRAFT: "DRAFT",
      REVIEW: "REVIEW",
      READY: "READY"
    };
    exports2.ElementType = exports2.$Enums.ElementType = {
      SC: "SC",
      MC: "MC",
      KPRIM: "KPRIM",
      FREE_TEXT: "FREE_TEXT",
      NUMERICAL: "NUMERICAL",
      CONTENT: "CONTENT",
      FLASHCARD: "FLASHCARD"
    };
    exports2.ElementInstanceType = exports2.$Enums.ElementInstanceType = {
      LIVE_QUIZ: "LIVE_QUIZ",
      PRACTICE_QUIZ: "PRACTICE_QUIZ",
      MICROLEARNING: "MICROLEARNING",
      GROUP_ACTIVITY: "GROUP_ACTIVITY"
    };
    exports2.ElementStackType = exports2.$Enums.ElementStackType = {
      LIVE_QUIZ: "LIVE_QUIZ",
      PRACTICE_QUIZ: "PRACTICE_QUIZ",
      MICROLEARNING: "MICROLEARNING",
      GROUP_ACTIVITY: "GROUP_ACTIVITY"
    };
    exports2.QuestionInstanceType = exports2.$Enums.QuestionInstanceType = {
      UNSET: "UNSET",
      SESSION: "SESSION",
      MICRO_SESSION: "MICRO_SESSION",
      LEARNING_ELEMENT: "LEARNING_ELEMENT",
      GROUP_ACTIVITY: "GROUP_ACTIVITY"
    };
    exports2.AchievementType = exports2.$Enums.AchievementType = {
      PARTICIPANT: "PARTICIPANT",
      GROUP: "GROUP",
      CLASS: "CLASS"
    };
    exports2.AchievementScope = exports2.$Enums.AchievementScope = {
      GLOBAL: "GLOBAL",
      COURSE: "COURSE"
    };
    exports2.AwardType = exports2.$Enums.AwardType = {
      PARTICIPANT: "PARTICIPANT",
      GROUP: "GROUP"
    };
    exports2.Locale = exports2.$Enums.Locale = {
      en: "en",
      de: "de"
    };
    exports2.LeaderboardType = exports2.$Enums.LeaderboardType = {
      SESSION: "SESSION",
      COURSE: "COURSE"
    };
    exports2.ElementOrderType = exports2.$Enums.ElementOrderType = {
      SEQUENTIAL: "SEQUENTIAL",
      SPACED_REPETITION: "SPACED_REPETITION"
    };
    exports2.PublicationStatus = exports2.$Enums.PublicationStatus = {
      DRAFT: "DRAFT",
      SCHEDULED: "SCHEDULED",
      PUBLISHED: "PUBLISHED"
    };
    exports2.SessionBlockStatus = exports2.$Enums.SessionBlockStatus = {
      SCHEDULED: "SCHEDULED",
      ACTIVE: "ACTIVE",
      EXECUTED: "EXECUTED"
    };
    exports2.AccessMode = exports2.$Enums.AccessMode = {
      PUBLIC: "PUBLIC",
      RESTRICTED: "RESTRICTED"
    };
    exports2.SessionStatus = exports2.$Enums.SessionStatus = {
      PREPARED: "PREPARED",
      SCHEDULED: "SCHEDULED",
      RUNNING: "RUNNING",
      COMPLETED: "COMPLETED"
    };
    exports2.LiveQuizStatus = exports2.$Enums.LiveQuizStatus = {
      PREPARED: "PREPARED",
      SCHEDULED: "SCHEDULED",
      RUNNING: "RUNNING",
      COMPLETED: "COMPLETED"
    };
    exports2.ParameterType = exports2.$Enums.ParameterType = {
      NUMBER: "NUMBER",
      STRING: "STRING"
    };
    exports2.GroupActivityStatus = exports2.$Enums.GroupActivityStatus = {
      DRAFT: "DRAFT",
      SCHEDULED: "SCHEDULED",
      PUBLISHED: "PUBLISHED",
      ENDED: "ENDED",
      GRADED: "GRADED"
    };
    exports2.ResponseCorrectness = exports2.$Enums.ResponseCorrectness = {
      CORRECT: "CORRECT",
      PARTIAL: "PARTIAL",
      WRONG: "WRONG"
    };
    exports2.UserLoginScope = exports2.$Enums.UserLoginScope = {
      ACCOUNT_OWNER: "ACCOUNT_OWNER",
      FULL_ACCESS: "FULL_ACCESS",
      SESSION_EXEC: "SESSION_EXEC",
      READ_ONLY: "READ_ONLY",
      OTP: "OTP",
      ACTIVATION: "ACTIVATION"
    };
    exports2.UserRole = exports2.$Enums.UserRole = {
      PARTICIPANT: "PARTICIPANT",
      USER: "USER",
      ADMIN: "ADMIN"
    };
    exports2.Prisma.ModelName = {
      ParticipantAnalytics: "ParticipantAnalytics",
      AggregatedAnalytics: "AggregatedAnalytics",
      CompetencyAnalytics: "CompetencyAnalytics",
      AggregatedCompetencyAnalytics: "AggregatedCompetencyAnalytics",
      ParticipantCourseAnalytics: "ParticipantCourseAnalytics",
      AggregatedCourseAnalytics: "AggregatedCourseAnalytics",
      CompetencyTree: "CompetencyTree",
      Competency: "Competency",
      Course: "Course",
      Element: "Element",
      ElementInstance: "ElementInstance",
      InstanceStatistics: "InstanceStatistics",
      ElementStack: "ElementStack",
      QuestionInstance: "QuestionInstance",
      Tag: "Tag",
      MediaFile: "MediaFile",
      Title: "Title",
      Achievement: "Achievement",
      ParticipantAchievementInstance: "ParticipantAchievementInstance",
      GroupAchievementInstance: "GroupAchievementInstance",
      ClassAchievementInstance: "ClassAchievementInstance",
      AwardEntry: "AwardEntry",
      Level: "Level",
      Migration: "Migration",
      EmailTemplate: "EmailTemplate",
      ParticipantAccount: "ParticipantAccount",
      Participant: "Participant",
      ParticipantGroup: "ParticipantGroup",
      GroupMessage: "GroupMessage",
      Participation: "Participation",
      GroupAssignmentPoolEntry: "GroupAssignmentPoolEntry",
      LeaderboardEntry: "LeaderboardEntry",
      PushSubscription: "PushSubscription",
      PracticeQuiz: "PracticeQuiz",
      SessionBlock: "SessionBlock",
      LiveSession: "LiveSession",
      LiveQuiz: "LiveQuiz",
      MicroLearning: "MicroLearning",
      GroupActivityParameter: "GroupActivityParameter",
      GroupActivityClue: "GroupActivityClue",
      GroupActivityClueInstance: "GroupActivityClueInstance",
      GroupActivity: "GroupActivity",
      GroupActivityClueAssignment: "GroupActivityClueAssignment",
      GroupActivityInstance: "GroupActivityInstance",
      Feedback: "Feedback",
      FeedbackResponse: "FeedbackResponse",
      ConfusionTimestep: "ConfusionTimestep",
      QuestionResponse: "QuestionResponse",
      QuestionResponseDetail: "QuestionResponseDetail",
      ElementFeedback: "ElementFeedback",
      Account: "Account",
      Session: "Session",
      VerificationToken: "VerificationToken",
      UserLogin: "UserLogin",
      User: "User"
    };
    var config2 = {
      "generator": {
        "name": "client",
        "provider": {
          "fromEnvVar": null,
          "value": "prisma-client-js"
        },
        "output": {
          "value": "/Users/julius/Desktop/IBF/klicker-uzh/packages/prisma/src/prisma/client",
          "fromEnvVar": null
        },
        "config": {
          "engineType": "library"
        },
        "binaryTargets": [
          {
            "fromEnvVar": null,
            "value": "darwin-arm64",
            "native": true
          },
          {
            "fromEnvVar": null,
            "value": "debian-openssl-1.1.x"
          },
          {
            "fromEnvVar": null,
            "value": "linux-musl-openssl-3.0.x"
          },
          {
            "fromEnvVar": null,
            "value": "debian-openssl-3.0.x"
          }
        ],
        "previewFeatures": [
          "fullTextIndex",
          "fullTextSearch",
          "postgresqlExtensions",
          "tracing",
          "prismaSchemaFolder"
        ],
        "sourceFilePath": "/Users/julius/Desktop/IBF/klicker-uzh/packages/prisma/src/prisma/schema/js.prisma",
        "isCustomOutput": true
      },
      "relativeEnvPaths": {
        "rootEnvPath": null
      },
      "relativePath": "../schema",
      "clientVersion": "5.21.0",
      "engineVersion": "08713a93b99d58f31485621c634b04983ae01d95",
      "datasourceNames": [
        "db"
      ],
      "activeProvider": "postgresql",
      "postinstall": false,
      "inlineDatasources": {
        "db": {
          "url": {
            "fromEnvVar": "DATABASE_URL",
            "value": null
          }
        }
      },
      "inlineSchema": 'enum AnalyticsType {\n  DAILY\n  WEEKLY\n  MONTHLY\n  COURSE // analytics for the entire course\n}\n\nenum ActivityLevel {\n  LOW\n  MEDIUM\n  HIGH\n}\n\n// All metrics are based on logged in participant activity only\nmodel ParticipantAnalytics {\n  id   Int           @id @default(autoincrement())\n  type AnalyticsType\n\n  timestamp DateTime @db.Date\n\n  // unsolvedQuestionsCount = responseCount - AggregatedAnalytics.totalElementsAvailable\n  trialsCount   Int // total number of questions attempted\n  responseCount Int // total number of unique questions attempted\n\n  // summed across all question attempts (non-unique)\n  totalScore  Int\n  totalPoints Int\n  totalXp     Int\n\n  // meanTrialsCount = meanCorrectCount + meanPartialCorrectCount + meanWrongCount\n  meanCorrectCount        Float @db.Real // aggregated over all questions\n  meanPartialCorrectCount Float @db.Real // aggregated over all questions\n  meanWrongCount          Float @db.Real // aggregated over all questions\n\n  // divide by responseCount to get the correctness rate\n  meanFirstCorrectCount Float @db.Real // aggregated over all questions\n  meanLastCorrectCount  Float @db.Real // aggregated over all questions\n\n  collectedAchievements String[]\n\n  competencyAnalytics CompetencyAnalytics[]\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  @@unique([type, courseId, participantId, timestamp])\n}\n\n// All metrics are based on logged in participant activity only\nmodel AggregatedAnalytics {\n  id   Int           @id @default(autoincrement())\n  type AnalyticsType\n\n  // all quantities are defined as the values at the end of the selected timeframe\n  timestamp              DateTime @db.Date\n  responseCount          Int\n  participantCount       Int\n  totalScore             Int\n  totalPoints            Int\n  totalXp                Int\n  totalElementsAvailable Int // total number of elements available at the end of selected timeframe (practice quizzes & microlearnings != instances linked to course)\n\n  aggregatedCompetencyAnalytics AggregatedCompetencyAnalytics[]\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  @@unique([type, courseId, timestamp])\n}\n\nmodel CompetencyAnalytics {\n  id Int @id @default(autoincrement())\n\n  unsolvedQuestionsCount  Int @db.SmallInt\n  lastCorrectCount        Int @db.SmallInt\n  lastPartialCorrectCount Int @db.SmallInt\n  lastWrongCount          Int @db.SmallInt\n\n  competency   Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  competencyId Int\n\n  // all metrics are only computed on weekly and course-wide basis\n  participantAnalytics   ParticipantAnalytics @relation(fields: [participantAnalyticsId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantAnalyticsId Int\n\n  @@unique([competencyId, participantAnalyticsId])\n}\n\nmodel AggregatedCompetencyAnalytics {\n  id Int @id @default(autoincrement())\n\n  meanUnsolvedQuestionsCount  Int @db.SmallInt\n  meanLastCorrectCount        Int @db.SmallInt\n  meanLastPartialCorrectCount Int @db.SmallInt\n  meanLastWrongCount          Int @db.SmallInt\n\n  competency   Competency @relation(fields: [competencyId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  competencyId Int\n\n  // all metrics are only computed on weekly and course-wide basis\n  aggregatedAnalytics   AggregatedAnalytics @relation(fields: [aggregatedAnalyticsId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  aggregatedAnalyticsId Int\n\n  @@unique([competencyId, aggregatedAnalyticsId])\n}\n\nmodel ParticipantCourseAnalytics {\n  id Int @id @default(autoincrement())\n\n  activeWeeks        Int\n  activeDaysPerWeek  Float @db.Real\n  meanElementsPerDay Float @db.Real\n\n  activityLevel ActivityLevel\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  @@unique([courseId, participantId])\n}\n\nmodel AggregatedCourseAnalytics {\n  id Int @id @default(autoincrement())\n\n  participantCount  Int\n  activityMonday    Int\n  activityTuesday   Int\n  activityWednesday Int\n  activityThursday  Int\n  activityFriday    Int\n  activitySaturday  Int\n  activitySunday    Int\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n}\n\nmodel CompetencyTree {\n  id Int @id @default(autoincrement())\n\n  name        String\n  description String?\n\n  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId String @db.Uuid\n\n  competencies Competency[]\n  courses      Course[]\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([ownerId, name])\n}\n\nmodel Competency {\n  id Int @id @default(autoincrement())\n\n  name        String\n  description String?\n\n  // left and right values for nested set queries\n  lft Int\n  rgt Int\n\n  analytics           CompetencyAnalytics[]\n  aggregatedAnalytics AggregatedCompetencyAnalytics[]\n\n  tree   CompetencyTree @relation(fields: [treeId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  treeId Int\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([treeId, lft, rgt])\n  @@unique([treeId, name])\n  @@index([treeId, lft])\n  @@index([treeId, rgt])\n}\n\nmodel Course {\n  id String @id @default(uuid()) @db.Uuid\n\n  isArchived Boolean @default(false)\n\n  pinCode Int @unique\n\n  name                  String\n  displayName           String\n  description           String?\n  color                 String   @default("#eaa07d")\n  startDate             DateTime\n  endDate               DateTime\n  notificationEmail     String?\n  isGamificationEnabled Boolean  @default(true)\n  areAnalyticsValid     Boolean  @default(false)\n\n  isGroupCreationEnabled    Boolean  @default(true)\n  groupDeadlineDate         DateTime\n  preferredGroupSize        Int      @default(3)\n  maxGroupSize              Int      @default(5)\n  randomAssignmentFinalized Boolean  @default(false)\n\n  sessions                   LiveSession[]\n  elementStacks              ElementStack[]\n  practiceQuizzes            PracticeQuiz[]\n  groupActivities            GroupActivity[]\n  leaderboard                LeaderboardEntry[]\n  awards                     AwardEntry[]\n  classAchievements          ClassAchievementInstance[]\n  achievements               Achievement[]\n  titles                     Title[]\n  participations             Participation[]\n  subscriptions              PushSubscription[]\n  participantGroups          ParticipantGroup[]\n  microLearnings             MicroLearning[]\n  liveQuizzes                LiveQuiz[]\n  participantAnalytics       ParticipantAnalytics[]\n  aggregatedAnalytics        AggregatedAnalytics[]\n  aggregatedCourseAnalytics  AggregatedCourseAnalytics[]\n  participantCourseAnalytics ParticipantCourseAnalytics[]\n  responses                  QuestionResponse[]\n  groupAssignmentPoolEntries GroupAssignmentPoolEntry[]\n\n  competencyTree   CompetencyTree? @relation(fields: [competencyTreeId], references: [id], onDelete: SetNull, onUpdate: Cascade)\n  competencyTreeId Int?\n\n  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\ndatasource db {\n  provider          = "postgres"\n  url               = env("DATABASE_URL")\n  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")\n}\n\n// ----- ELEMENTS -----\n// #region\nenum ElementStatus {\n  DRAFT\n  REVIEW\n  READY\n}\n\nenum ElementType {\n  // TODO: remove old types, to be migrated to new ones\n  SC\n  MC\n  KPRIM\n  FREE_TEXT\n  NUMERICAL\n\n  // new types\n  CONTENT\n  FLASHCARD\n\n  // TODO: add new types to be migrated to (careful to migrate questionData.type as well with a script)\n  // QUESTION_SC\n  // QUESTION_MC\n  // QUESTION_KPRIM\n  // QUESTION_FREE_TEXT\n  // QUESTION_NUMERICAL\n}\n\nmodel Element {\n  id Int @id @default(autoincrement())\n\n  version Int @default(1) // used to track question versions, incremented on each update\n\n  originalId String?\n\n  isArchived Boolean @default(false)\n  isDeleted  Boolean @default(false)\n\n  name        String\n  content     String // markdown content\n  explanation String? // markdown content\n\n  pointsMultiplier Int @default(1) // currently only relevant for FLASHCARD and QUESTION types\n\n  /// [PrismaElementOptions]\n  options Json\n\n  status ElementStatus @default(READY)\n  type   ElementType\n\n  tags Tag[]\n\n  // TODO: as we renamed Question to Element, it will need to have instances and elementInstances in parallel for a while. once we migrated all question instances and activities to elements, we can remove instances with a migration.\n  instances        QuestionInstance[]\n  elementInstances ElementInstance[]\n  feedbacks        ElementFeedback[]\n\n  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([ownerId, originalId])\n}\n\nenum ElementInstanceType {\n  LIVE_QUIZ\n  PRACTICE_QUIZ\n  MICROLEARNING\n  GROUP_ACTIVITY\n}\n\nmodel ElementInstance {\n  id Int @id @default(autoincrement())\n\n  originalId String?\n\n  // TODO: remove after migration to new data structure\n  migrationId String\n\n  type        ElementInstanceType\n  elementType ElementType\n  order       Int\n\n  /// [PrismaElementInstanceOptions]\n  options Json // contains element type specific settings (resetTimeDays for LE instances, pointsMultiplier where relevant)\n\n  /// [PrismaElementData]\n  elementData Json // contains a copy of relevant element data\n\n  /// [PrismaElementResults]\n  results Json // contains the collection of gathered results by logged in participants\n\n  /// [PrismaElementResults]\n  anonymousResults Json // contains the collection of gathered results by anonymous participants\n\n  responses          QuestionResponse[]\n  detailResponses    QuestionResponseDetail[]\n  feedbacks          ElementFeedback[]\n  instanceStatistics InstanceStatistics?\n\n  element        Element      @relation(fields: [elementId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  elementId      Int\n  elementStack   ElementStack @relation(fields: [elementStackId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  elementStackId Int\n  owner          User         @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId        String       @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([type, migrationId])\n  @@unique([type, elementStackId, order])\n  @@unique([ownerId, originalId])\n}\n\nmodel InstanceStatistics {\n  anonymousCorrectCount        Int?\n  anonymousPartialCorrectCount Int?\n  anonymousWrongCount          Int?\n\n  // aggregated element feedbacks of all students (only last feedback)\n  upvoteCount   Int?\n  downvoteCount Int?\n\n  // only logged in participants impact the following counts (consistent with results)\n  correctCount             Int  @default(0)\n  partialCorrectCount      Int  @default(0)\n  wrongCount               Int  @default(0)\n  firstCorrectCount        Int?\n  firstPartialCorrectCount Int?\n  firstWrongCount          Int?\n  lastCorrectCount         Int?\n  lastPartialCorrectCount  Int?\n  lastWrongCount           Int?\n\n  // only logged in participants impact the following counts (consistent with results and counts above)\n  uniqueParticipantCount Int  @default(0)\n  averageTimeSpent       Int? // computed based on averageTimeSpent per participant\n\n  elementInstance   ElementInstance @relation(fields: [elementInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  elementInstanceId Int             @id\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nenum ElementStackType {\n  LIVE_QUIZ\n  PRACTICE_QUIZ\n  MICROLEARNING\n  GROUP_ACTIVITY\n}\n\nmodel ElementStack {\n  id Int @id @default(autoincrement())\n\n  // element stacks need to have an originalId to enable migration from v2 session blocks\n  originalId String? @unique\n\n  type  ElementStackType\n  order Int\n\n  displayName String?\n  description String?\n\n  /// [PrismaElementStackOptions]\n  options Json\n\n  elements     ElementInstance[]\n  bookmarkedBy Participation[]\n\n  practiceQuiz   PracticeQuiz? @relation(fields: [practiceQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  practiceQuizId String?       @db.Uuid\n\n  microLearning   MicroLearning? @relation(fields: [microLearningId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  microLearningId String?        @db.Uuid\n\n  liveQuiz         LiveQuiz?  @relation(fields: [liveQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  liveQuizId       String?    @db.Uuid\n  activeInLiveQuiz LiveQuiz[] @relation(name: "ActiveElementStack")\n\n  groupActivity   GroupActivity? @relation(fields: [groupActivityId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupActivityId String?        @unique @db.Uuid\n\n  course   Course? @relation(fields: [courseId], references: [id])\n  courseId String? @db.Uuid\n\n  @@unique([type, practiceQuizId, order])\n  @@unique([type, microLearningId, order])\n  @@unique([type, liveQuizId, order])\n  @@unique([type, groupActivityId, order])\n}\n\n// #endregion\n\n// ----- QUESTION POOL (LEGACY) -----\n// #region\nenum QuestionInstanceType {\n  UNSET\n  SESSION\n  MICRO_SESSION\n  LEARNING_ELEMENT\n  GROUP_ACTIVITY\n}\n\nmodel QuestionInstance {\n  id Int @id @default(autoincrement())\n\n  originalId String?\n\n  type  QuestionInstanceType?\n  order Int?\n\n  participants     Int  @default(0)\n  pointsMultiplier Int  @default(1)\n  resetTimeDays    Int?\n  maxBonusPoints   Int?\n  timeToZeroBonus  Int?\n\n  /// [PrismaQuestionData]\n  questionData Json\n\n  /// [PrismaQuestionResults]\n  results Json\n\n  sessionBlock   SessionBlock? @relation(fields: [sessionBlockId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  sessionBlockId Int?\n\n  question   Element? @relation(fields: [questionId], references: [id], onDelete: SetNull, onUpdate: Cascade)\n  questionId Int?\n  owner      User     @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId    String   @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([type, sessionBlockId, order])\n  @@unique([ownerId, originalId])\n}\n\n// #endregion\n\n// ----- TAGS AND SKILLS -----\n// #region\nmodel Tag {\n  id   Int    @id @default(autoincrement())\n  name String\n\n  order Int @default(0)\n\n  originalId String?\n\n  questions Element[]\n\n  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([ownerId, name])\n  @@unique([ownerId, originalId])\n}\n\n// #endregion\n\n// ----- MEDIA LIBRARY -----\n// #region\nmodel MediaFile {\n  id String @id @default(uuid()) @db.Uuid\n\n  href        String  @unique\n  name        String\n  type        String\n  description String?\n\n  originalId String?\n\n  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([ownerId, originalId])\n}\n\n// #endregion\n\n// ----- ACHIEVEMENTS -----\n// #region\nenum AchievementType {\n  PARTICIPANT // achievement awarded to individual participants\n  GROUP // achievement awarded to a group of participants\n  CLASS // achievement awarded on a global level (e.g., when reaching a class goal)\n}\n\nenum AchievementScope {\n  GLOBAL // achievements defined at the application level\n  COURSE // achievement defined at the course level\n}\n\n// Titles can be awarded to participants upon receipt of an achievement\n// They are managed on a course-level\nmodel Title {\n  id Int @id @default(autoincrement())\n\n  name      String\n  awardedBy Achievement[]\n  awardedTo Participant[]\n  course    Course        @relation(fields: [courseId], references: [id])\n  courseId  String        @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([courseId, name])\n}\n\n// Achievements are awarded to participants, groups, or classes\n// They are managed on a course-level and can yield points for the leaderboard, individual XP, or titles\n// TODO: add mechanisms to automate the awarding of achievements\nmodel Achievement {\n  id Int @id @default(autoincrement())\n\n  name          String? // TODO: remove once migrated to nameDE and nameEN\n  description   String? // TODO: remove once migrated to descriptionDE and descriptionEN\n  nameDE        String?\n  descriptionDE String?\n  nameEN        String?\n  descriptionEN String?\n\n  icon      String\n  iconColor String?\n\n  rewardedPoints Int?\n  rewardedXP     Int?\n  rewardedTitles Title[]\n  type           AchievementType\n  scope          AchievementScope @default(GLOBAL)\n\n  course   Course? @relation(fields: [courseId], references: [id])\n  courseId String? @db.Uuid\n\n  participantInstances ParticipantAchievementInstance[]\n  groupInstances       GroupAchievementInstance[]\n  classInstances       ClassAchievementInstance[]\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel ParticipantAchievementInstance {\n  id Int @id @default(autoincrement())\n\n  achievedAt    DateTime\n  achievedCount Int      @default(1)\n\n  achievement   Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  achievementId Int\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([participantId, achievementId])\n}\n\nmodel GroupAchievementInstance {\n  id Int @id @default(autoincrement())\n\n  achievedAt    DateTime\n  achievedCount Int      @default(1)\n\n  achievement   Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  achievementId Int\n\n  group   ParticipantGroup @relation(fields: [groupId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupId String           @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([groupId, achievementId])\n}\n\nmodel ClassAchievementInstance {\n  id Int @id @default(autoincrement())\n\n  achievedAt    DateTime\n  achievedCount Int      @default(1)\n\n  achievement   Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  achievementId Int\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([courseId, achievementId])\n}\n\n// #endregion\n\n// ----- AWARDS -----\n// #region\nenum AwardType {\n  PARTICIPANT\n  GROUP\n}\n\nmodel AwardEntry {\n  id Int @id @default(autoincrement())\n\n  order       Int\n  type        AwardType\n  name        String\n  displayName String\n  description String\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  participant   Participant? @relation(fields: [participantId], references: [id])\n  participantId String?      @db.Uuid\n\n  participantGroup   ParticipantGroup? @relation(fields: [participantGroupId], references: [id])\n  participantGroupId String?           @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([courseId, type, order])\n  @@unique([courseId, type, name])\n}\n\n// #endregion\n\n// ----- LEVELS -----\n// #region\nmodel Level {\n  id Int @id @default(autoincrement())\n\n  index      Int     @unique\n  name       String?\n  requiredXp Int\n  avatar     String?\n\n  nextLevel   Level?  @relation("level", fields: [nextLevelIx], references: [index])\n  nextLevelIx Int?\n  prevLevel   Level[] @relation("level")\n}\n\n// #endregion\n\ngenerator client {\n  provider        = "prisma-client-js"\n  previewFeatures = ["fullTextSearch", "fullTextIndex", "postgresqlExtensions", "prismaSchemaFolder", "tracing"]\n  output          = "../client"\n  binaryTargets   = ["native", "debian-openssl-1.1.x", "linux-musl-openssl-3.0.x", "debian-openssl-3.0.x"]\n}\n\ngenerator pothos {\n  provider     = "prisma-pothos-types"\n  clientOutput = "@klicker-uzh/prisma"\n  output       = "../client/pothos.ts"\n}\n\ngenerator json {\n  provider = "prisma-json-types-generator"\n}\n\nmodel Migration {\n  id String @id\n\n  createdAt DateTime @default(now())\n}\n\nmodel EmailTemplate {\n  name String @id\n\n  html String\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel ParticipantAccount {\n  id String @id @default(uuid()) @db.Uuid\n\n  ssoId   String @unique\n  ssoType String @default("LTI1.1")\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  createdAt DateTime @default(now())\n\n  @@unique([participantId, ssoType])\n}\n\nmodel Participant {\n  id String @id @default(uuid()) @db.Uuid\n\n  email        String? @unique\n  isEmailValid Boolean @default(false)\n  username     String  @unique\n  password     String\n  avatar       String?\n  xp           Int     @default(0)\n\n  /// [PrismaAvatarSettings]\n  avatarSettings Json?\n\n  isActive        Boolean @default(true)\n  isProfilePublic Boolean @default(true)\n  isSSOAccount    Boolean @default(false)\n\n  lastLoginAt DateTime?\n\n  locale Locale @default(en)\n\n  participantGroups          ParticipantGroup[]\n  accounts                   ParticipantAccount[]\n  participations             Participation[]\n  questionResponses          QuestionResponse[]\n  detailQuestionResponses    QuestionResponseDetail[]\n  feedbacks                  Feedback[]\n  elementFeedbacks           ElementFeedback[]\n  leaderboards               LeaderboardEntry[]\n  subscriptions              PushSubscription[]\n  clueAssignments            GroupActivityClueAssignment[]\n  awards                     AwardEntry[]\n  achievements               ParticipantAchievementInstance[]\n  titles                     Title[]\n  participantAnalytics       ParticipantAnalytics[]\n  participantCourseAnalytics ParticipantCourseAnalytics[]\n  groupAssignmentPoolEntries GroupAssignmentPoolEntry[]\n  messages                   GroupMessage[]\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel ParticipantGroup {\n  id String @id @default(uuid()) @db.Uuid\n\n  name String\n  code Int\n\n  groupActivityScore Int @default(0)\n  averageMemberScore Int @default(0)\n\n  participants    Participant[]\n  groupActivities GroupActivityInstance[]\n  awards          AwardEntry[]\n  achievements    GroupAchievementInstance[]\n  messages        GroupMessage[]\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  randomlyAssigned Boolean @default(false)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([courseId, code])\n}\n\nmodel GroupMessage {\n  id Int @id @default(autoincrement())\n\n  content String\n\n  group   ParticipantGroup @relation(fields: [groupId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupId String           @db.Uuid\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel Participation {\n  id Int @id @default(autoincrement())\n\n  // enable participants to disable their participation\n  // keeps the collected points but removes them from all views\n  isActive Boolean @default(false)\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  courseLeaderboard   LeaderboardEntry? @relation(fields: [courseLeaderboardId], references: [id], onDelete: SetNull, onUpdate: SetNull)\n  courseLeaderboardId Int?              @unique\n\n  sessionLeaderboards LeaderboardEntry[] @relation("SessionLeaderboards")\n\n  responses               QuestionResponse[]\n  detailResponses         QuestionResponseDetail[]\n  subscriptions           PushSubscription[]\n  completedMicroLearnings String[]\n  bookmarkedElementStacks ElementStack[]\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([courseId, participantId])\n}\n\nmodel GroupAssignmentPoolEntry {\n  id Int @id @default(autoincrement())\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  createdAt DateTime @default(now())\n\n  @@unique([courseId, participantId])\n}\n\nenum LeaderboardType {\n  SESSION\n  COURSE\n}\n\nmodel LeaderboardEntry {\n  id Int @id @default(autoincrement())\n\n  type LeaderboardType\n\n  score Int\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  participation Participation?\n\n  sessionParticipation   Participation? @relation("SessionLeaderboards", fields: [sessionParticipationId], references: [id])\n  sessionParticipationId Int?\n\n  // TODO: remove after migration\n  session   LiveSession? @relation(fields: [sessionId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  sessionId String?      @db.Uuid\n\n  liveQuiz   LiveQuiz? @relation(fields: [liveQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  liveQuizId String?   @db.Uuid\n\n  course   Course? @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String? @db.Uuid\n\n  @@unique([type, participantId, sessionId])\n  @@unique([type, participantId, courseId])\n  @@unique([type, participantId, liveQuizId])\n}\n\nmodel PushSubscription {\n  id Int @id @default(autoincrement())\n\n  endpoint       String\n  expirationTime Int?\n  p256dh         String\n  auth           String\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  participation   Participation @relation(fields: [participationId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participationId Int\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  createdAt DateTime @default(now())\n\n  @@unique([participantId, courseId, endpoint])\n}\n\nenum PublicationStatus {\n  DRAFT\n  SCHEDULED\n  PUBLISHED\n}\n\n// ----- PRACTICE QUIZZES -----\n// #region\nenum ElementOrderType {\n  SEQUENTIAL\n  SPACED_REPETITION\n}\n\nmodel PracticeQuiz {\n  id String @id @default(uuid()) @db.Uuid\n\n  name             String\n  displayName      String\n  description      String?\n  pointsMultiplier Int               @default(1)\n  resetTimeDays    Int               @default(6)\n  orderType        ElementOrderType  @default(SPACED_REPETITION)\n  status           PublicationStatus @default(DRAFT)\n  availableFrom    DateTime?\n\n  isDeleted Boolean @default(false)\n\n  stacks ElementStack[]\n\n  responses       QuestionResponse[]\n  responseDetails QuestionResponseDetail[]\n\n  startedCount   Int @default(0) // >= completedCount (at least one answer given to quiz)\n  completedCount Int @default(0) // >= repeatedCount (every instance answered at least once)\n  repeatedCount  Int @default(0) // (every instance answered at least twice)\n\n  owner    User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId  String @db.Uuid\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\n// #endregion\n\n// ----- SESSIONS -----\n// #region\nenum SessionBlockStatus {\n  SCHEDULED\n  ACTIVE\n  EXECUTED\n}\n\nmodel SessionBlock {\n  id Int @id @default(autoincrement())\n\n  originalId String?\n\n  order  Int\n  status SessionBlockStatus @default(SCHEDULED)\n\n  expiresAt       DateTime?\n  timeLimit       Int?\n  randomSelection Int?\n\n  execution Int @default(0)\n\n  instances QuestionInstance[]\n\n  activeInSession LiveSession[] @relation(name: "ActiveSessionBlock")\n\n  session   LiveSession @relation(fields: [sessionId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  sessionId String      @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([sessionId, order])\n  @@unique([sessionId, originalId])\n}\n\n// TODO: delete after migration\nenum SessionStatus {\n  PREPARED\n  SCHEDULED\n  RUNNING\n  COMPLETED\n}\n\nenum AccessMode {\n  PUBLIC\n  RESTRICTED\n}\n\n// TODO: delete after migration\nmodel LiveSession {\n  id String @id @default(uuid()) @db.Uuid\n\n  originalId                 String?\n  isLiveQAEnabled            Boolean @default(false)\n  isConfusionFeedbackEnabled Boolean @default(true)\n  isModerationEnabled        Boolean @default(true)\n  isGamificationEnabled      Boolean @default(false)\n  isDeleted                  Boolean @default(false)\n\n  namespace        String    @default(uuid()) @db.Uuid\n  pinCode          Int?\n  name             String\n  displayName      String\n  description      String?\n  startedAt        DateTime?\n  finishedAt       DateTime?\n  linkTo           String?\n  pointsMultiplier Int       @default(1)\n  maxBonusPoints   Int       @default(45)\n  timeToZeroBonus  Int       @default(20)\n\n  accessMode AccessMode    @default(PUBLIC)\n  status     SessionStatus @default(PREPARED)\n\n  activeBlock   SessionBlock? @relation(name: "ActiveSessionBlock", fields: [activeBlockId], references: [id])\n  activeBlockId Int?\n\n  blocks      SessionBlock[]\n  leaderboard LeaderboardEntry[]\n\n  feedbacks Feedback[]\n\n  confusionFeedbacks ConfusionTimestep[]\n\n  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId String @db.Uuid\n\n  course   Course? @relation(fields: [courseId], references: [id], onDelete: SetNull, onUpdate: Cascade)\n  courseId String? @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([ownerId, originalId])\n}\n\nenum LiveQuizStatus {\n  PREPARED\n  SCHEDULED\n  RUNNING\n  COMPLETED\n}\n\nmodel LiveQuiz {\n  id String @id @default(uuid()) @db.Uuid\n\n  originalId                 String? @unique\n  isLiveQAEnabled            Boolean @default(false)\n  isConfusionFeedbackEnabled Boolean @default(true)\n  isModerationEnabled        Boolean @default(true)\n  isGamificationEnabled      Boolean @default(false)\n  isDeleted                  Boolean @default(false)\n\n  namespace        String    @default(uuid()) @db.Uuid\n  pinCode          Int?\n  name             String\n  displayName      String\n  description      String?\n  startedAt        DateTime?\n  finishedAt       DateTime?\n  // linkTo           String? // TODO: drop this functionality/field?\n  pointsMultiplier Int       @default(1)\n  maxBonusPoints   Int       @default(45)\n  timeToZeroBonus  Int       @default(20)\n\n  accessMode AccessMode     @default(PUBLIC)\n  status     LiveQuizStatus @default(PREPARED)\n\n  activeStack   ElementStack? @relation(name: "ActiveElementStack", fields: [activeStackId], references: [id])\n  activeStackId Int?\n\n  stacks      ElementStack[]\n  leaderboard LeaderboardEntry[]\n\n  feedbacks Feedback[]\n\n  confusionFeedbacks ConfusionTimestep[]\n\n  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId String @db.Uuid\n\n  course   Course? @relation(fields: [courseId], references: [id], onDelete: SetNull, onUpdate: Cascade)\n  courseId String? @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\n// #endregion\n\n// ----- MICROLEARNING -----\n// #region\nmodel MicroLearning {\n  id String @id @default(uuid()) @db.Uuid\n\n  name             String\n  displayName      String\n  pointsMultiplier Int               @default(1)\n  description      String?\n  status           PublicationStatus @default(DRAFT)\n\n  scheduledStartAt DateTime\n  scheduledEndAt   DateTime\n\n  arePushNotificationsSent Boolean @default(false)\n  isDeleted                Boolean @default(false)\n\n  stacks ElementStack[]\n\n  responses       QuestionResponse[]\n  responseDetails QuestionResponseDetail[]\n\n  startedCount   Int @default(0) // >= completedCount (at least one answer given to quiz)\n  completedCount Int @default(0) // (every instance answered at least once)\n\n  owner    User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId  String @db.Uuid\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\n// #endregion\n\n// ----- GROUP ACTIVITIES -----\n// #region\nenum ParameterType {\n  NUMBER\n  STRING\n}\n\nmodel GroupActivityParameter {\n  id Int @id @default(autoincrement())\n\n  name        String\n  displayName String\n\n  type    ParameterType\n  options String[]\n  unit    String?\n\n  groupActivity   GroupActivity @relation(fields: [groupActivityId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupActivityId String        @db.Uuid\n\n  @@unique([groupActivityId, name])\n}\n\nmodel GroupActivityClue {\n  id Int @id @default(autoincrement())\n\n  name        String\n  displayName String\n\n  type  ParameterType\n  value String\n  unit  String?\n\n  groupActivity   GroupActivity @relation(fields: [groupActivityId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupActivityId String        @db.Uuid\n\n  @@unique([groupActivityId, name])\n}\n\nmodel GroupActivityClueInstance {\n  id Int @id @default(autoincrement())\n\n  name        String\n  displayName String\n\n  type  ParameterType\n  value String\n  unit  String?\n\n  assignments             GroupActivityClueAssignment[]\n  groupActivityInstance   GroupActivityInstance         @relation(fields: [groupActivityInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupActivityInstanceId Int\n\n  @@unique([groupActivityInstanceId, name])\n}\n\nenum GroupActivityStatus {\n  DRAFT\n  SCHEDULED\n  PUBLISHED\n  ENDED\n  GRADED\n}\n\nmodel GroupActivity {\n  id String @id @default(uuid()) @db.Uuid\n\n  name        String\n  displayName String\n  status      GroupActivityStatus @default(DRAFT)\n\n  pointsMultiplier Int @default(1)\n\n  description      String?\n  scheduledStartAt DateTime\n  scheduledEndAt   DateTime\n\n  isDeleted Boolean @default(false)\n\n  stacks ElementStack[]\n\n  parameters        GroupActivityParameter[]\n  clues             GroupActivityClue[]\n  activityInstances GroupActivityInstance[]\n\n  owner    User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  ownerId  String @db.Uuid\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel GroupActivityClueAssignment {\n  id Int @id @default(autoincrement())\n\n  groupActivityClueInstance   GroupActivityClueInstance @relation(fields: [groupActivityClueInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupActivityClueInstanceId Int\n  groupActivityInstance       GroupActivityInstance     @relation(fields: [groupActivityInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupActivityInstanceId     Int\n  participant                 Participant               @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId               String                    @db.Uuid\n}\n\nmodel GroupActivityInstance {\n  id Int @id @default(autoincrement())\n\n  clues                  GroupActivityClueInstance[]\n  clueInstanceAssignment GroupActivityClueAssignment[]\n\n  /// [PrismaGroupActivityDecisions]\n  decisions            Json?\n  decisionsSubmittedAt DateTime?\n  /// [PrismaGroupActivityResults]\n  results              Json?\n  resultsComputedAt    DateTime?\n\n  groupActivity   GroupActivity @relation(fields: [groupActivityId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupActivityId String        @db.Uuid\n\n  group   ParticipantGroup @relation(fields: [groupId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  groupId String           @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([groupActivityId, groupId])\n}\n\n// #endregion\n\n// ----- LIVE Q&A -----\n// #region\nmodel Feedback {\n  id Int @id @default(autoincrement())\n\n  isPublished Boolean @default(false)\n  isPinned    Boolean @default(false)\n  isResolved  Boolean @default(false)\n\n  content String\n  votes   Int    @default(0)\n\n  responses FeedbackResponse[]\n\n  resolvedAt DateTime?\n\n  // TODO: remove after migration\n  session   LiveSession? @relation(fields: [sessionId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  sessionId String?      @db.Uuid\n\n  liveQuiz   LiveQuiz? @relation(fields: [liveQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  liveQuizId String?   @db.Uuid\n\n  participant   Participant? @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String?      @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel FeedbackResponse {\n  id Int @id @default(autoincrement())\n\n  content           String\n  positiveReactions Int    @default(0)\n  negativeReactions Int    @default(0)\n\n  feedback   Feedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  feedbackId Int\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n\nmodel ConfusionTimestep {\n  id Int @id @default(autoincrement())\n\n  difficulty Int\n  speed      Int\n\n  // TODO: remove after migration\n  session   LiveSession? @relation(fields: [sessionId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  sessionId String?      @db.Uuid\n\n  liveQuiz   LiveQuiz? @relation(fields: [liveQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  liveQuizId String?   @db.Uuid\n\n  createdAt DateTime @default(now())\n}\n\n// #endregion\n\nenum ResponseCorrectness {\n  CORRECT\n  PARTIAL\n  WRONG\n}\n\nmodel QuestionResponse {\n  id Int @id @default(autoincrement())\n\n  trialsCount Int @default(0)\n\n  totalScore         Float     @default(0)\n  totalPointsAwarded Float?    @default(0)\n  totalXpAwarded     Float     @default(0)\n  averageTimeSpent   Int       @default(0) // TODO: remove default value after applying migration\n  lastAwardedAt      DateTime?\n  lastXpAwardedAt    DateTime?\n  lastAnsweredAt     DateTime?\n\n  correctCount       Int       @default(0)\n  correctCountStreak Int       @default(0)\n  lastCorrectAt      DateTime?\n\n  partialCorrectCount  Int       @default(0)\n  lastPartialCorrectAt DateTime?\n\n  wrongCount  Int       @default(0)\n  lastWrongAt DateTime?\n\n  // spaced repetition parameters\n  eFactor   Float     @default(2.5)\n  interval  Int       @default(1)\n  nextDueAt DateTime?\n\n  /// [PrismaSingleQuestionResponse]\n  firstResponse            Json\n  firstResponseCorrectness ResponseCorrectness\n\n  /// [PrismaSingleQuestionResponse]\n  lastResponse            Json\n  lastResponseCorrectness ResponseCorrectness\n\n  /// [PrismaElementResults]\n  aggregatedResponses Json?\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  participation   Participation @relation(fields: [participationId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participationId Int\n\n  elementInstance   ElementInstance @relation(fields: [elementInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  elementInstanceId Int\n\n  practiceQuiz   PracticeQuiz? @relation(fields: [practiceQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  practiceQuizId String?       @db.Uuid\n\n  microLearning   MicroLearning? @relation(fields: [microLearningId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  microLearningId String?        @db.Uuid\n\n  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  courseId String @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  isMigrated Boolean @default(false)\n\n  @@unique([participantId, elementInstanceId])\n  @@index([practiceQuizId])\n  @@index([microLearningId])\n  @@index([practiceQuizId, participantId])\n  @@index([microLearningId, participantId])\n}\n\nmodel QuestionResponseDetail {\n  id Int @id @default(autoincrement())\n\n  score         Float  @default(0)\n  pointsAwarded Float? @default(0)\n  xpAwarded     Float  @default(0)\n  timeSpent     Int    @default(0) // TODO: remove default value after applying migration\n\n  /// [PrismaSingleQuestionResponse]\n  response Json\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  participation   Participation @relation(fields: [participationId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participationId Int\n\n  elementInstance   ElementInstance @relation(fields: [elementInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  elementInstanceId Int\n\n  practiceQuiz   PracticeQuiz? @relation(fields: [practiceQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  practiceQuizId String?       @db.Uuid\n\n  microLearning   MicroLearning? @relation(fields: [microLearningId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  microLearningId String?        @db.Uuid\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@index([practiceQuizId])\n  @@index([microLearningId])\n  @@index([practiceQuizId, participantId])\n  @@index([microLearningId, participantId])\n}\n\nmodel ElementFeedback {\n  id Int @id @default(autoincrement())\n\n  upvote   Boolean @default(false)\n  downvote Boolean @default(false)\n  feedback String?\n\n  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  participantId String      @db.Uuid\n\n  elementInstance   ElementInstance @relation(fields: [elementInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  elementInstanceId Int\n\n  element   Element @relation(fields: [elementId], references: [id], onDelete: Cascade, onUpdate: Cascade)\n  elementId Int\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([participantId, elementInstanceId])\n}\n\nenum UserRole {\n  PARTICIPANT\n  USER\n  ADMIN\n}\n\nmodel Account {\n  id String @id @default(uuid()) @db.Uuid\n\n  type              String\n  provider          String\n  providerAccountId String\n  refresh_token     String? @db.Text\n  access_token      String? @db.Text\n  expires_at        Int?\n  token_type        String?\n  scope             String?\n  id_token          String? @db.Text\n  session_state     String?\n\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n  userId String @db.Uuid\n\n  @@unique([provider, providerAccountId])\n}\n\nmodel Session {\n  id String @id @default(uuid()) @db.Uuid\n\n  sessionToken String   @unique\n  expires      DateTime\n\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n  userId String @db.Uuid\n}\n\nmodel VerificationToken {\n  identifier String\n  token      String   @unique\n  expires    DateTime\n\n  @@unique([identifier, token])\n}\n\nenum UserLoginScope {\n  ACCOUNT_OWNER\n  FULL_ACCESS\n  SESSION_EXEC\n  READ_ONLY\n  OTP\n  ACTIVATION\n}\n\nmodel UserLogin {\n  id String @id @default(uuid()) @db.Uuid\n\n  name        String         @default("-")\n  password    String\n  scope       UserLoginScope @default(READ_ONLY)\n  lastLoginAt DateTime?\n\n  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)\n  userId String @db.Uuid\n}\n\nenum Locale {\n  en\n  de\n}\n\nmodel User {\n  id String @id @default(uuid()) @db.Uuid\n\n  originalId String? @unique\n\n  name               String?\n  email              String    @unique\n  emailVerified      DateTime?\n  sendProjectUpdates Boolean   @default(false)\n  image              String?\n\n  shortname           String    @unique\n  lastLoginAt         DateTime?\n  deletionToken       String?\n  deletionRequestedAt DateTime?\n  loginToken          String?\n  loginTokenExpiresAt DateTime?\n\n  locale Locale @default(en)\n\n  role UserRole @default(USER)\n\n  catalystInstitutional Boolean @default(false)\n  catalystIndividual    Boolean @default(false)\n  catalystTier          String?\n\n  logins            UserLogin[]\n  session           Session[]\n  accounts          Account[]\n  courses           Course[]\n  questions         Element[]\n  mediaFiles        MediaFile[]\n  tags              Tag[]\n  questionInstances QuestionInstance[]\n  sessions          LiveSession[]\n  groupActivities   GroupActivity[]\n  elementInstances  ElementInstance[]\n  practiceQuizzes   PracticeQuiz[]\n  microLearnings    MicroLearning[]\n  liveQuizzes       LiveQuiz[]\n  competencyTrees   CompetencyTree[]\n\n  firstLogin Boolean @default(true)\n\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}\n',
      "inlineSchemaHash": "eccf90554d267ffba1a597758c73797132ec9c42d6cfef858e6e89c264ac0025",
      "copyEngine": true
    };
    var fs2 = require("fs");
    config2.dirname = __dirname;
    var _a2;
    if (!fs2.existsSync(path.join(__dirname, "schema.prisma"))) {
      const alternativePaths = [
        "src/prisma/client",
        "prisma/client"
      ];
      const alternativePath = (_a2 = alternativePaths.find((altPath) => {
        return fs2.existsSync(path.join(process.cwd(), altPath, "schema.prisma"));
      })) != null ? _a2 : alternativePaths[0];
      config2.dirname = path.join(process.cwd(), alternativePath);
      config2.isBundled = true;
    }
    config2.runtimeDataModel = JSON.parse('{"models":{"ParticipantAnalytics":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AnalyticsType","isGenerated":false,"isUpdatedAt":false},{"name":"timestamp","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"trialsCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"responseCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"totalScore","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"totalPoints","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"totalXp","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"meanCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Float","isGenerated":false,"isUpdatedAt":false},{"name":"meanPartialCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Float","isGenerated":false,"isUpdatedAt":false},{"name":"meanWrongCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Float","isGenerated":false,"isUpdatedAt":false},{"name":"meanFirstCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Float","isGenerated":false,"isUpdatedAt":false},{"name":"meanLastCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Float","isGenerated":false,"isUpdatedAt":false},{"name":"collectedAchievements","kind":"scalar","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"competencyAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CompetencyAnalytics","relationName":"CompetencyAnalyticsToParticipantAnalytics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToParticipantAnalytics","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToParticipantAnalytics","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["type","courseId","participantId","timestamp"]],"uniqueIndexes":[{"name":null,"fields":["type","courseId","participantId","timestamp"]}],"isGenerated":false},"AggregatedAnalytics":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AnalyticsType","isGenerated":false,"isUpdatedAt":false},{"name":"timestamp","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"responseCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"participantCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"totalScore","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"totalPoints","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"totalXp","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"totalElementsAvailable","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"aggregatedCompetencyAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AggregatedCompetencyAnalytics","relationName":"AggregatedAnalyticsToAggregatedCompetencyAnalytics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"AggregatedAnalyticsToCourse","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["type","courseId","timestamp"]],"uniqueIndexes":[{"name":null,"fields":["type","courseId","timestamp"]}],"isGenerated":false},"CompetencyAnalytics":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"unsolvedQuestionsCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"lastCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"lastPartialCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"lastWrongCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"competency","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Competency","relationName":"CompetencyToCompetencyAnalytics","relationFromFields":["competencyId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"competencyId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"participantAnalytics","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantAnalytics","relationName":"CompetencyAnalyticsToParticipantAnalytics","relationFromFields":["participantAnalyticsId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantAnalyticsId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["competencyId","participantAnalyticsId"]],"uniqueIndexes":[{"name":null,"fields":["competencyId","participantAnalyticsId"]}],"isGenerated":false},"AggregatedCompetencyAnalytics":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"meanUnsolvedQuestionsCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"meanLastCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"meanLastPartialCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"meanLastWrongCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"competency","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Competency","relationName":"AggregatedCompetencyAnalyticsToCompetency","relationFromFields":["competencyId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"competencyId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"aggregatedAnalytics","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AggregatedAnalytics","relationName":"AggregatedAnalyticsToAggregatedCompetencyAnalytics","relationFromFields":["aggregatedAnalyticsId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"aggregatedAnalyticsId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["competencyId","aggregatedAnalyticsId"]],"uniqueIndexes":[{"name":null,"fields":["competencyId","aggregatedAnalyticsId"]}],"isGenerated":false},"ParticipantCourseAnalytics":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"activeWeeks","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activeDaysPerWeek","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Float","isGenerated":false,"isUpdatedAt":false},{"name":"meanElementsPerDay","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Float","isGenerated":false,"isUpdatedAt":false},{"name":"activityLevel","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ActivityLevel","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToParticipantCourseAnalytics","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToParticipantCourseAnalytics","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["courseId","participantId"]],"uniqueIndexes":[{"name":null,"fields":["courseId","participantId"]}],"isGenerated":false},"AggregatedCourseAnalytics":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"participantCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activityMonday","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activityTuesday","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activityWednesday","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activityThursday","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activityFriday","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activitySaturday","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"activitySunday","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"AggregatedCourseAnalyticsToCourse","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"CompetencyTree":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"CompetencyTreeToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"competencies","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Competency","relationName":"CompetencyToCompetencyTree","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"courses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CompetencyTreeToCourse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["ownerId","name"]],"uniqueIndexes":[{"name":null,"fields":["ownerId","name"]}],"isGenerated":false},"Competency":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"lft","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"rgt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"analytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CompetencyAnalytics","relationName":"CompetencyToCompetencyAnalytics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"aggregatedAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AggregatedCompetencyAnalytics","relationName":"AggregatedCompetencyAnalyticsToCompetency","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"tree","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CompetencyTree","relationName":"CompetencyToCompetencyTree","relationFromFields":["treeId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"treeId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["treeId","lft","rgt"],["treeId","name"]],"uniqueIndexes":[{"name":null,"fields":["treeId","lft","rgt"]},{"name":null,"fields":["treeId","name"]}],"isGenerated":false},"Course":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"isArchived","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"pinCode","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"color","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":"#eaa07d","isGenerated":false,"isUpdatedAt":false},{"name":"startDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"endDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"notificationEmail","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"isGamificationEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"areAnalyticsValid","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isGroupCreationEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"groupDeadlineDate","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"preferredGroupSize","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":3,"isGenerated":false,"isUpdatedAt":false},{"name":"maxGroupSize","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":5,"isGenerated":false,"isUpdatedAt":false},{"name":"randomAssignmentFinalized","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"sessions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveSession","relationName":"CourseToLiveSession","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"elementStacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"CourseToElementStack","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuizzes","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PracticeQuiz","relationName":"CourseToPracticeQuiz","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupActivities","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivity","relationName":"CourseToGroupActivity","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"leaderboard","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaderboardEntry","relationName":"CourseToLeaderboardEntry","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"awards","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AwardEntry","relationName":"AwardEntryToCourse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"classAchievements","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ClassAchievementInstance","relationName":"ClassAchievementInstanceToCourse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"achievements","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Achievement","relationName":"AchievementToCourse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"titles","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Title","relationName":"CourseToTitle","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participations","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"CourseToParticipation","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"subscriptions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PushSubscription","relationName":"CourseToPushSubscription","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participantGroups","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantGroup","relationName":"CourseToParticipantGroup","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"microLearnings","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"MicroLearning","relationName":"CourseToMicroLearning","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"liveQuizzes","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveQuiz","relationName":"CourseToLiveQuiz","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participantAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantAnalytics","relationName":"CourseToParticipantAnalytics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"aggregatedAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AggregatedAnalytics","relationName":"AggregatedAnalyticsToCourse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"aggregatedCourseAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AggregatedCourseAnalytics","relationName":"AggregatedCourseAnalyticsToCourse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participantCourseAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantCourseAnalytics","relationName":"CourseToParticipantCourseAnalytics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"responses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponse","relationName":"CourseToQuestionResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupAssignmentPoolEntries","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupAssignmentPoolEntry","relationName":"CourseToGroupAssignmentPoolEntry","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"competencyTree","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CompetencyTree","relationName":"CompetencyTreeToCourse","relationFromFields":["competencyTreeId"],"relationToFields":["id"],"relationOnDelete":"SetNull","isGenerated":false,"isUpdatedAt":false},{"name":"competencyTreeId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"CourseToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Element":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"version","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"isArchived","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isDeleted","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"content","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"explanation","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"pointsMultiplier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"options","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaElementOptions]"},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"ElementStatus","default":"READY","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementType","isGenerated":false,"isUpdatedAt":false},{"name":"tags","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Tag","relationName":"ElementToTag","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"instances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionInstance","relationName":"ElementToQuestionInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"elementInstances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstance","relationName":"ElementToElementInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"feedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementFeedback","relationName":"ElementToElementFeedback","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"ElementToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["ownerId","originalId"]],"uniqueIndexes":[{"name":null,"fields":["ownerId","originalId"]}],"isGenerated":false},"ElementInstance":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"migrationId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstanceType","isGenerated":false,"isUpdatedAt":false},{"name":"elementType","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementType","isGenerated":false,"isUpdatedAt":false},{"name":"order","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"options","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaElementInstanceOptions]"},{"name":"elementData","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaElementData]"},{"name":"results","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaElementResults]"},{"name":"anonymousResults","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaElementResults]"},{"name":"responses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponse","relationName":"ElementInstanceToQuestionResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"detailResponses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponseDetail","relationName":"ElementInstanceToQuestionResponseDetail","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"feedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementFeedback","relationName":"ElementFeedbackToElementInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"instanceStatistics","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"InstanceStatistics","relationName":"ElementInstanceToInstanceStatistics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"element","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Element","relationName":"ElementToElementInstance","relationFromFields":["elementId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"elementId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"elementStack","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"ElementInstanceToElementStack","relationFromFields":["elementStackId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"elementStackId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"ElementInstanceToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["type","migrationId"],["type","elementStackId","order"],["ownerId","originalId"]],"uniqueIndexes":[{"name":null,"fields":["type","migrationId"]},{"name":null,"fields":["type","elementStackId","order"]},{"name":null,"fields":["ownerId","originalId"]}],"isGenerated":false},"InstanceStatistics":{"dbName":null,"fields":[{"name":"anonymousCorrectCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"anonymousPartialCorrectCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"anonymousWrongCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"upvoteCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"downvoteCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"correctCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"partialCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"wrongCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"firstCorrectCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"firstPartialCorrectCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"firstWrongCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"lastCorrectCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"lastPartialCorrectCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"lastWrongCount","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"uniqueParticipantCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"averageTimeSpent","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstance","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstance","relationName":"ElementInstanceToInstanceStatistics","relationFromFields":["elementInstanceId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstanceId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ElementStack":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStackType","isGenerated":false,"isUpdatedAt":false},{"name":"order","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"options","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaElementStackOptions]"},{"name":"elements","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstance","relationName":"ElementInstanceToElementStack","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"bookmarkedBy","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"ElementStackToParticipation","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuiz","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PracticeQuiz","relationName":"ElementStackToPracticeQuiz","relationFromFields":["practiceQuizId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuizId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"microLearning","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"MicroLearning","relationName":"ElementStackToMicroLearning","relationFromFields":["microLearningId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"microLearningId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuiz","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveQuiz","relationName":"ElementStackToLiveQuiz","relationFromFields":["liveQuizId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuizId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"activeInLiveQuiz","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveQuiz","relationName":"ActiveElementStack","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupActivity","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivity","relationName":"ElementStackToGroupActivity","relationFromFields":["groupActivityId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityId","kind":"scalar","isList":false,"isRequired":false,"isUnique":true,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToElementStack","relationFromFields":["courseId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["type","practiceQuizId","order"],["type","microLearningId","order"],["type","liveQuizId","order"],["type","groupActivityId","order"]],"uniqueIndexes":[{"name":null,"fields":["type","practiceQuizId","order"]},{"name":null,"fields":["type","microLearningId","order"]},{"name":null,"fields":["type","liveQuizId","order"]},{"name":null,"fields":["type","groupActivityId","order"]}],"isGenerated":false},"QuestionInstance":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionInstanceType","isGenerated":false,"isUpdatedAt":false},{"name":"order","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"participants","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"pointsMultiplier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"resetTimeDays","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"maxBonusPoints","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"timeToZeroBonus","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"questionData","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaQuestionData]"},{"name":"results","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaQuestionResults]"},{"name":"sessionBlock","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SessionBlock","relationName":"QuestionInstanceToSessionBlock","relationFromFields":["sessionBlockId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"sessionBlockId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"question","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Element","relationName":"ElementToQuestionInstance","relationFromFields":["questionId"],"relationToFields":["id"],"relationOnDelete":"SetNull","isGenerated":false,"isUpdatedAt":false},{"name":"questionId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"QuestionInstanceToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["type","sessionBlockId","order"],["ownerId","originalId"]],"uniqueIndexes":[{"name":null,"fields":["type","sessionBlockId","order"]},{"name":null,"fields":["ownerId","originalId"]}],"isGenerated":false},"Tag":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"order","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"questions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Element","relationName":"ElementToTag","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"TagToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["ownerId","name"],["ownerId","originalId"]],"uniqueIndexes":[{"name":null,"fields":["ownerId","name"]},{"name":null,"fields":["ownerId","originalId"]}],"isGenerated":false},"MediaFile":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"href","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"MediaFileToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["ownerId","originalId"]],"uniqueIndexes":[{"name":null,"fields":["ownerId","originalId"]}],"isGenerated":false},"Title":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"awardedBy","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Achievement","relationName":"AchievementToTitle","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"awardedTo","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToTitle","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToTitle","relationFromFields":["courseId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["courseId","name"]],"uniqueIndexes":[{"name":null,"fields":["courseId","name"]}],"isGenerated":false},"Achievement":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"nameDE","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"descriptionDE","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"nameEN","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"descriptionEN","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"icon","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"iconColor","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"rewardedPoints","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"rewardedXP","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"rewardedTitles","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Title","relationName":"AchievementToTitle","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AchievementType","isGenerated":false,"isUpdatedAt":false},{"name":"scope","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"AchievementScope","default":"GLOBAL","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"AchievementToCourse","relationFromFields":["courseId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participantInstances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantAchievementInstance","relationName":"AchievementToParticipantAchievementInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupInstances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupAchievementInstance","relationName":"AchievementToGroupAchievementInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"classInstances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ClassAchievementInstance","relationName":"AchievementToClassAchievementInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ParticipantAchievementInstance":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"achievedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"achievedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"achievement","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Achievement","relationName":"AchievementToParticipantAchievementInstance","relationFromFields":["achievementId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"achievementId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToParticipantAchievementInstance","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["participantId","achievementId"]],"uniqueIndexes":[{"name":null,"fields":["participantId","achievementId"]}],"isGenerated":false},"GroupAchievementInstance":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"achievedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"achievedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"achievement","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Achievement","relationName":"AchievementToGroupAchievementInstance","relationFromFields":["achievementId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"achievementId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"group","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantGroup","relationName":"GroupAchievementInstanceToParticipantGroup","relationFromFields":["groupId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["groupId","achievementId"]],"uniqueIndexes":[{"name":null,"fields":["groupId","achievementId"]}],"isGenerated":false},"ClassAchievementInstance":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"achievedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"achievedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"achievement","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Achievement","relationName":"AchievementToClassAchievementInstance","relationFromFields":["achievementId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"achievementId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"ClassAchievementInstanceToCourse","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["courseId","achievementId"]],"uniqueIndexes":[{"name":null,"fields":["courseId","achievementId"]}],"isGenerated":false},"AwardEntry":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"order","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AwardType","isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"AwardEntryToCourse","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"AwardEntryToParticipant","relationFromFields":["participantId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participantGroup","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantGroup","relationName":"AwardEntryToParticipantGroup","relationFromFields":["participantGroupId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"participantGroupId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["courseId","type","order"],["courseId","type","name"]],"uniqueIndexes":[{"name":null,"fields":["courseId","type","order"]},{"name":null,"fields":["courseId","type","name"]}],"isGenerated":false},"Level":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"index","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"requiredXp","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"avatar","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"nextLevel","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Level","relationName":"level","relationFromFields":["nextLevelIx"],"relationToFields":["index"],"isGenerated":false,"isUpdatedAt":false},{"name":"nextLevelIx","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"prevLevel","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Level","relationName":"level","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Migration":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"EmailTemplate":{"dbName":null,"fields":[{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"html","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ParticipantAccount":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"ssoId","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"ssoType","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":"LTI1.1","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToParticipantAccount","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["participantId","ssoType"]],"uniqueIndexes":[{"name":null,"fields":["participantId","ssoType"]}],"isGenerated":false},"Participant":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"email","kind":"scalar","isList":false,"isRequired":false,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"isEmailValid","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"username","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"password","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"avatar","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"xp","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"avatarSettings","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaAvatarSettings]"},{"name":"isActive","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"isProfilePublic","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"isSSOAccount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"lastLoginAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"locale","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Locale","default":"en","isGenerated":false,"isUpdatedAt":false},{"name":"participantGroups","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantGroup","relationName":"ParticipantToParticipantGroup","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"accounts","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantAccount","relationName":"ParticipantToParticipantAccount","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participations","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"ParticipantToParticipation","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"questionResponses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponse","relationName":"ParticipantToQuestionResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"detailQuestionResponses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponseDetail","relationName":"ParticipantToQuestionResponseDetail","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"feedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Feedback","relationName":"FeedbackToParticipant","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"elementFeedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementFeedback","relationName":"ElementFeedbackToParticipant","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"leaderboards","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaderboardEntry","relationName":"LeaderboardEntryToParticipant","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"subscriptions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PushSubscription","relationName":"ParticipantToPushSubscription","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"clueAssignments","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityClueAssignment","relationName":"GroupActivityClueAssignmentToParticipant","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"awards","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AwardEntry","relationName":"AwardEntryToParticipant","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"achievements","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantAchievementInstance","relationName":"ParticipantToParticipantAchievementInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"titles","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Title","relationName":"ParticipantToTitle","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participantAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantAnalytics","relationName":"ParticipantToParticipantAnalytics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"participantCourseAnalytics","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantCourseAnalytics","relationName":"ParticipantToParticipantCourseAnalytics","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupAssignmentPoolEntries","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupAssignmentPoolEntry","relationName":"GroupAssignmentPoolEntryToParticipant","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"messages","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupMessage","relationName":"GroupMessageToParticipant","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ParticipantGroup":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"code","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityScore","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"averageMemberScore","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"participants","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToParticipantGroup","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupActivities","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityInstance","relationName":"GroupActivityInstanceToParticipantGroup","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"awards","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"AwardEntry","relationName":"AwardEntryToParticipantGroup","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"achievements","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupAchievementInstance","relationName":"GroupAchievementInstanceToParticipantGroup","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"messages","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupMessage","relationName":"GroupMessageToParticipantGroup","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToParticipantGroup","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"randomlyAssigned","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["courseId","code"]],"uniqueIndexes":[{"name":null,"fields":["courseId","code"]}],"isGenerated":false},"GroupMessage":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"content","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"group","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantGroup","relationName":"GroupMessageToParticipantGroup","relationFromFields":["groupId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"GroupMessageToParticipant","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"Participation":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"isActive","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToParticipation","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToParticipation","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"courseLeaderboard","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaderboardEntry","relationName":"LeaderboardEntryToParticipation","relationFromFields":["courseLeaderboardId"],"relationToFields":["id"],"relationOnDelete":"SetNull","isGenerated":false,"isUpdatedAt":false},{"name":"courseLeaderboardId","kind":"scalar","isList":false,"isRequired":false,"isUnique":true,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"sessionLeaderboards","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaderboardEntry","relationName":"SessionLeaderboards","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"responses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponse","relationName":"ParticipationToQuestionResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"detailResponses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponseDetail","relationName":"ParticipationToQuestionResponseDetail","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"subscriptions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PushSubscription","relationName":"ParticipationToPushSubscription","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"completedMicroLearnings","kind":"scalar","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"bookmarkedElementStacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"ElementStackToParticipation","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["courseId","participantId"]],"uniqueIndexes":[{"name":null,"fields":["courseId","participantId"]}],"isGenerated":false},"GroupAssignmentPoolEntry":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToGroupAssignmentPoolEntry","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"GroupAssignmentPoolEntryToParticipant","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["courseId","participantId"]],"uniqueIndexes":[{"name":null,"fields":["courseId","participantId"]}],"isGenerated":false},"LeaderboardEntry":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaderboardType","isGenerated":false,"isUpdatedAt":false},{"name":"score","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"LeaderboardEntryToParticipant","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participation","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"LeaderboardEntryToParticipation","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"sessionParticipation","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"SessionLeaderboards","relationFromFields":["sessionParticipationId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"sessionParticipationId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"session","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveSession","relationName":"LeaderboardEntryToLiveSession","relationFromFields":["sessionId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"sessionId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuiz","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveQuiz","relationName":"LeaderboardEntryToLiveQuiz","relationFromFields":["liveQuizId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuizId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToLeaderboardEntry","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["type","participantId","sessionId"],["type","participantId","courseId"],["type","participantId","liveQuizId"]],"uniqueIndexes":[{"name":null,"fields":["type","participantId","sessionId"]},{"name":null,"fields":["type","participantId","courseId"]},{"name":null,"fields":["type","participantId","liveQuizId"]}],"isGenerated":false},"PushSubscription":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"endpoint","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"expirationTime","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"p256dh","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"auth","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToPushSubscription","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participation","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"ParticipationToPushSubscription","relationFromFields":["participationId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participationId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToPushSubscription","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["participantId","courseId","endpoint"]],"uniqueIndexes":[{"name":null,"fields":["participantId","courseId","endpoint"]}],"isGenerated":false},"PracticeQuiz":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"pointsMultiplier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"resetTimeDays","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":6,"isGenerated":false,"isUpdatedAt":false},{"name":"orderType","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"ElementOrderType","default":"SPACED_REPETITION","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"PublicationStatus","default":"DRAFT","isGenerated":false,"isUpdatedAt":false},{"name":"availableFrom","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"isDeleted","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"stacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"ElementStackToPracticeQuiz","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"responses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponse","relationName":"PracticeQuizToQuestionResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"responseDetails","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponseDetail","relationName":"PracticeQuizToQuestionResponseDetail","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"startedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"completedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"repeatedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"PracticeQuizToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToPracticeQuiz","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"SessionBlock":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"order","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"SessionBlockStatus","default":"SCHEDULED","isGenerated":false,"isUpdatedAt":false},{"name":"expiresAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"timeLimit","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"randomSelection","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"execution","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"instances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionInstance","relationName":"QuestionInstanceToSessionBlock","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"activeInSession","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveSession","relationName":"ActiveSessionBlock","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"session","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveSession","relationName":"LiveSessionToSessionBlock","relationFromFields":["sessionId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"sessionId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["sessionId","order"],["sessionId","originalId"]],"uniqueIndexes":[{"name":null,"fields":["sessionId","order"]},{"name":null,"fields":["sessionId","originalId"]}],"isGenerated":false},"LiveSession":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"isLiveQAEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isConfusionFeedbackEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"isModerationEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"isGamificationEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isDeleted","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"namespace","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"pinCode","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"startedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"finishedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"linkTo","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"pointsMultiplier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"maxBonusPoints","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":45,"isGenerated":false,"isUpdatedAt":false},{"name":"timeToZeroBonus","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":20,"isGenerated":false,"isUpdatedAt":false},{"name":"accessMode","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"AccessMode","default":"PUBLIC","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"SessionStatus","default":"PREPARED","isGenerated":false,"isUpdatedAt":false},{"name":"activeBlock","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SessionBlock","relationName":"ActiveSessionBlock","relationFromFields":["activeBlockId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"activeBlockId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"blocks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"SessionBlock","relationName":"LiveSessionToSessionBlock","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"leaderboard","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaderboardEntry","relationName":"LeaderboardEntryToLiveSession","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"feedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Feedback","relationName":"FeedbackToLiveSession","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"confusionFeedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ConfusionTimestep","relationName":"ConfusionTimestepToLiveSession","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"LiveSessionToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToLiveSession","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"SetNull","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["ownerId","originalId"]],"uniqueIndexes":[{"name":null,"fields":["ownerId","originalId"]}],"isGenerated":false},"LiveQuiz":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"isLiveQAEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isConfusionFeedbackEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"isModerationEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"isGamificationEnabled","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isDeleted","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"namespace","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"pinCode","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"startedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"finishedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"pointsMultiplier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"maxBonusPoints","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":45,"isGenerated":false,"isUpdatedAt":false},{"name":"timeToZeroBonus","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":20,"isGenerated":false,"isUpdatedAt":false},{"name":"accessMode","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"AccessMode","default":"PUBLIC","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"LiveQuizStatus","default":"PREPARED","isGenerated":false,"isUpdatedAt":false},{"name":"activeStack","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"ActiveElementStack","relationFromFields":["activeStackId"],"relationToFields":["id"],"isGenerated":false,"isUpdatedAt":false},{"name":"activeStackId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"stacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"ElementStackToLiveQuiz","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"leaderboard","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LeaderboardEntry","relationName":"LeaderboardEntryToLiveQuiz","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"feedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Feedback","relationName":"FeedbackToLiveQuiz","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"confusionFeedbacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ConfusionTimestep","relationName":"ConfusionTimestepToLiveQuiz","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"LiveQuizToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToLiveQuiz","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"SetNull","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"MicroLearning":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"pointsMultiplier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"PublicationStatus","default":"DRAFT","isGenerated":false,"isUpdatedAt":false},{"name":"scheduledStartAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"scheduledEndAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"arePushNotificationsSent","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isDeleted","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"stacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"ElementStackToMicroLearning","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"responses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponse","relationName":"MicroLearningToQuestionResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"responseDetails","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionResponseDetail","relationName":"MicroLearningToQuestionResponseDetail","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"startedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"completedCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"MicroLearningToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToMicroLearning","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"GroupActivityParameter":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParameterType","isGenerated":false,"isUpdatedAt":false},{"name":"options","kind":"scalar","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"unit","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivity","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivity","relationName":"GroupActivityToGroupActivityParameter","relationFromFields":["groupActivityId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["groupActivityId","name"]],"uniqueIndexes":[{"name":null,"fields":["groupActivityId","name"]}],"isGenerated":false},"GroupActivityClue":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParameterType","isGenerated":false,"isUpdatedAt":false},{"name":"value","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"unit","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivity","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivity","relationName":"GroupActivityToGroupActivityClue","relationFromFields":["groupActivityId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["groupActivityId","name"]],"uniqueIndexes":[{"name":null,"fields":["groupActivityId","name"]}],"isGenerated":false},"GroupActivityClueInstance":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParameterType","isGenerated":false,"isUpdatedAt":false},{"name":"value","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"unit","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"assignments","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityClueAssignment","relationName":"GroupActivityClueAssignmentToGroupActivityClueInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityInstance","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityInstance","relationName":"GroupActivityClueInstanceToGroupActivityInstance","relationFromFields":["groupActivityInstanceId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityInstanceId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["groupActivityInstanceId","name"]],"uniqueIndexes":[{"name":null,"fields":["groupActivityInstanceId","name"]}],"isGenerated":false},"GroupActivity":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"displayName","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"status","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"GroupActivityStatus","default":"DRAFT","isGenerated":false,"isUpdatedAt":false},{"name":"pointsMultiplier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"description","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"scheduledStartAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"scheduledEndAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"isDeleted","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"stacks","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementStack","relationName":"ElementStackToGroupActivity","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"parameters","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityParameter","relationName":"GroupActivityToGroupActivityParameter","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"clues","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityClue","relationName":"GroupActivityToGroupActivityClue","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"activityInstances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityInstance","relationName":"GroupActivityToGroupActivityInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"owner","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"GroupActivityToUser","relationFromFields":["ownerId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"ownerId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToGroupActivity","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"GroupActivityClueAssignment":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityClueInstance","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityClueInstance","relationName":"GroupActivityClueAssignmentToGroupActivityClueInstance","relationFromFields":["groupActivityClueInstanceId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityClueInstanceId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityInstance","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityInstance","relationName":"GroupActivityClueAssignmentToGroupActivityInstance","relationFromFields":["groupActivityInstanceId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityInstanceId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"GroupActivityClueAssignmentToParticipant","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"GroupActivityInstance":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"clues","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityClueInstance","relationName":"GroupActivityClueInstanceToGroupActivityInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"clueInstanceAssignment","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivityClueAssignment","relationName":"GroupActivityClueAssignmentToGroupActivityInstance","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"decisions","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaGroupActivityDecisions]"},{"name":"decisionsSubmittedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"results","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaGroupActivityResults]"},{"name":"resultsComputedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivity","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivity","relationName":"GroupActivityToGroupActivityInstance","relationFromFields":["groupActivityId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupActivityId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"group","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ParticipantGroup","relationName":"GroupActivityInstanceToParticipantGroup","relationFromFields":["groupId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"groupId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["groupActivityId","groupId"]],"uniqueIndexes":[{"name":null,"fields":["groupActivityId","groupId"]}],"isGenerated":false},"Feedback":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"isPublished","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isPinned","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"isResolved","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"content","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"votes","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"responses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"FeedbackResponse","relationName":"FeedbackToFeedbackResponse","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"resolvedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"session","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveSession","relationName":"FeedbackToLiveSession","relationFromFields":["sessionId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"sessionId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuiz","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveQuiz","relationName":"FeedbackToLiveQuiz","relationFromFields":["liveQuizId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuizId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"FeedbackToParticipant","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"FeedbackResponse":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"content","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"positiveReactions","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"negativeReactions","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"feedback","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Feedback","relationName":"FeedbackToFeedbackResponse","relationFromFields":["feedbackId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"feedbackId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ConfusionTimestep":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"difficulty","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"speed","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"session","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveSession","relationName":"ConfusionTimestepToLiveSession","relationFromFields":["sessionId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"sessionId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuiz","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveQuiz","relationName":"ConfusionTimestepToLiveQuiz","relationFromFields":["liveQuizId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"liveQuizId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"QuestionResponse":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"trialsCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"totalScore","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Float","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"totalPointsAwarded","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Float","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"totalXpAwarded","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Float","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"averageTimeSpent","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"lastAwardedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"lastXpAwardedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"lastAnsweredAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"correctCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"correctCountStreak","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"lastCorrectAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"partialCorrectCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"lastPartialCorrectAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"wrongCount","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"lastWrongAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"eFactor","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Float","default":2.5,"isGenerated":false,"isUpdatedAt":false},{"name":"interval","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":1,"isGenerated":false,"isUpdatedAt":false},{"name":"nextDueAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"firstResponse","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaSingleQuestionResponse]"},{"name":"firstResponseCorrectness","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ResponseCorrectness","isGenerated":false,"isUpdatedAt":false},{"name":"lastResponse","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaSingleQuestionResponse]"},{"name":"lastResponseCorrectness","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ResponseCorrectness","isGenerated":false,"isUpdatedAt":false},{"name":"aggregatedResponses","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaElementResults]"},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToQuestionResponse","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participation","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"ParticipationToQuestionResponse","relationFromFields":["participationId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participationId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstance","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstance","relationName":"ElementInstanceToQuestionResponse","relationFromFields":["elementInstanceId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstanceId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuiz","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PracticeQuiz","relationName":"PracticeQuizToQuestionResponse","relationFromFields":["practiceQuizId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuizId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"microLearning","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"MicroLearning","relationName":"MicroLearningToQuestionResponse","relationFromFields":["microLearningId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"microLearningId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"course","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToQuestionResponse","relationFromFields":["courseId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"courseId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true},{"name":"isMigrated","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["participantId","elementInstanceId"]],"uniqueIndexes":[{"name":null,"fields":["participantId","elementInstanceId"]}],"isGenerated":false},"QuestionResponseDetail":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"score","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Float","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"pointsAwarded","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Float","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"xpAwarded","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Float","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"timeSpent","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":0,"isGenerated":false,"isUpdatedAt":false},{"name":"response","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Json","isGenerated":false,"isUpdatedAt":false,"documentation":"[PrismaSingleQuestionResponse]"},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ParticipantToQuestionResponseDetail","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participation","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participation","relationName":"ParticipationToQuestionResponseDetail","relationFromFields":["participationId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participationId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstance","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstance","relationName":"ElementInstanceToQuestionResponseDetail","relationFromFields":["elementInstanceId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstanceId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuiz","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PracticeQuiz","relationName":"PracticeQuizToQuestionResponseDetail","relationFromFields":["practiceQuizId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuizId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"microLearning","kind":"object","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"MicroLearning","relationName":"MicroLearningToQuestionResponseDetail","relationFromFields":["microLearningId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"microLearningId","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"ElementFeedback":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"Int","default":{"name":"autoincrement","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"upvote","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"downvote","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"feedback","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"participant","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Participant","relationName":"ElementFeedbackToParticipant","relationFromFields":["participantId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"participantId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstance","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstance","relationName":"ElementFeedbackToElementInstance","relationFromFields":["elementInstanceId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"elementInstanceId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"element","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Element","relationName":"ElementToElementFeedback","relationFromFields":["elementId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"elementId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[["participantId","elementInstanceId"]],"uniqueIndexes":[{"name":null,"fields":["participantId","elementInstanceId"]}],"isGenerated":false},"Account":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"type","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"provider","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"providerAccountId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"refresh_token","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"access_token","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"expires_at","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Int","isGenerated":false,"isUpdatedAt":false},{"name":"token_type","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"scope","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"id_token","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"session_state","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"AccountToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["provider","providerAccountId"]],"uniqueIndexes":[{"name":null,"fields":["provider","providerAccountId"]}],"isGenerated":false},"Session":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"sessionToken","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"expires","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"SessionToUser","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"VerificationToken":{"dbName":null,"fields":[{"name":"identifier","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"token","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"expires","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[["identifier","token"]],"uniqueIndexes":[{"name":null,"fields":["identifier","token"]}],"isGenerated":false},"UserLogin":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":"-","isGenerated":false,"isUpdatedAt":false},{"name":"password","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"scope","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"UserLoginScope","default":"READ_ONLY","isGenerated":false,"isUpdatedAt":false},{"name":"lastLoginAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"user","kind":"object","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"User","relationName":"UserToUserLogin","relationFromFields":["userId"],"relationToFields":["id"],"relationOnDelete":"Cascade","isGenerated":false,"isUpdatedAt":false},{"name":"userId","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":true,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false},"User":{"dbName":null,"fields":[{"name":"id","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":true,"isReadOnly":false,"hasDefaultValue":true,"type":"String","default":{"name":"uuid(4)","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"originalId","kind":"scalar","isList":false,"isRequired":false,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"name","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"email","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"emailVerified","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"sendProjectUpdates","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"image","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"shortname","kind":"scalar","isList":false,"isRequired":true,"isUnique":true,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"lastLoginAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"deletionToken","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"deletionRequestedAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"loginToken","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"loginTokenExpiresAt","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":false},{"name":"locale","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Locale","default":"en","isGenerated":false,"isUpdatedAt":false},{"name":"role","kind":"enum","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"UserRole","default":"USER","isGenerated":false,"isUpdatedAt":false},{"name":"catalystInstitutional","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"catalystIndividual","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":false,"isGenerated":false,"isUpdatedAt":false},{"name":"catalystTier","kind":"scalar","isList":false,"isRequired":false,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"String","isGenerated":false,"isUpdatedAt":false},{"name":"logins","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"UserLogin","relationName":"UserToUserLogin","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"session","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Session","relationName":"SessionToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"accounts","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Account","relationName":"AccountToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"courses","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Course","relationName":"CourseToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"questions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Element","relationName":"ElementToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"mediaFiles","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"MediaFile","relationName":"MediaFileToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"tags","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"Tag","relationName":"TagToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"questionInstances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"QuestionInstance","relationName":"QuestionInstanceToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"sessions","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveSession","relationName":"LiveSessionToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"groupActivities","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"GroupActivity","relationName":"GroupActivityToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"elementInstances","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"ElementInstance","relationName":"ElementInstanceToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"practiceQuizzes","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"PracticeQuiz","relationName":"PracticeQuizToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"microLearnings","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"MicroLearning","relationName":"MicroLearningToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"liveQuizzes","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"LiveQuiz","relationName":"LiveQuizToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"competencyTrees","kind":"object","isList":true,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"CompetencyTree","relationName":"CompetencyTreeToUser","relationFromFields":[],"relationToFields":[],"isGenerated":false,"isUpdatedAt":false},{"name":"firstLogin","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"Boolean","default":true,"isGenerated":false,"isUpdatedAt":false},{"name":"createdAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":true,"type":"DateTime","default":{"name":"now","args":[]},"isGenerated":false,"isUpdatedAt":false},{"name":"updatedAt","kind":"scalar","isList":false,"isRequired":true,"isUnique":false,"isId":false,"isReadOnly":false,"hasDefaultValue":false,"type":"DateTime","isGenerated":false,"isUpdatedAt":true}],"primaryKey":null,"uniqueFields":[],"uniqueIndexes":[],"isGenerated":false}},"enums":{"AnalyticsType":{"values":[{"name":"DAILY","dbName":null},{"name":"WEEKLY","dbName":null},{"name":"MONTHLY","dbName":null},{"name":"COURSE","dbName":null}],"dbName":null},"ActivityLevel":{"values":[{"name":"LOW","dbName":null},{"name":"MEDIUM","dbName":null},{"name":"HIGH","dbName":null}],"dbName":null},"ElementStatus":{"values":[{"name":"DRAFT","dbName":null},{"name":"REVIEW","dbName":null},{"name":"READY","dbName":null}],"dbName":null},"ElementType":{"values":[{"name":"SC","dbName":null},{"name":"MC","dbName":null},{"name":"KPRIM","dbName":null},{"name":"FREE_TEXT","dbName":null},{"name":"NUMERICAL","dbName":null},{"name":"CONTENT","dbName":null},{"name":"FLASHCARD","dbName":null}],"dbName":null},"ElementInstanceType":{"values":[{"name":"LIVE_QUIZ","dbName":null},{"name":"PRACTICE_QUIZ","dbName":null},{"name":"MICROLEARNING","dbName":null},{"name":"GROUP_ACTIVITY","dbName":null}],"dbName":null},"ElementStackType":{"values":[{"name":"LIVE_QUIZ","dbName":null},{"name":"PRACTICE_QUIZ","dbName":null},{"name":"MICROLEARNING","dbName":null},{"name":"GROUP_ACTIVITY","dbName":null}],"dbName":null},"QuestionInstanceType":{"values":[{"name":"UNSET","dbName":null},{"name":"SESSION","dbName":null},{"name":"MICRO_SESSION","dbName":null},{"name":"LEARNING_ELEMENT","dbName":null},{"name":"GROUP_ACTIVITY","dbName":null}],"dbName":null},"AchievementType":{"values":[{"name":"PARTICIPANT","dbName":null},{"name":"GROUP","dbName":null},{"name":"CLASS","dbName":null}],"dbName":null},"AchievementScope":{"values":[{"name":"GLOBAL","dbName":null},{"name":"COURSE","dbName":null}],"dbName":null},"AwardType":{"values":[{"name":"PARTICIPANT","dbName":null},{"name":"GROUP","dbName":null}],"dbName":null},"LeaderboardType":{"values":[{"name":"SESSION","dbName":null},{"name":"COURSE","dbName":null}],"dbName":null},"PublicationStatus":{"values":[{"name":"DRAFT","dbName":null},{"name":"SCHEDULED","dbName":null},{"name":"PUBLISHED","dbName":null}],"dbName":null},"ElementOrderType":{"values":[{"name":"SEQUENTIAL","dbName":null},{"name":"SPACED_REPETITION","dbName":null}],"dbName":null},"SessionBlockStatus":{"values":[{"name":"SCHEDULED","dbName":null},{"name":"ACTIVE","dbName":null},{"name":"EXECUTED","dbName":null}],"dbName":null},"SessionStatus":{"values":[{"name":"PREPARED","dbName":null},{"name":"SCHEDULED","dbName":null},{"name":"RUNNING","dbName":null},{"name":"COMPLETED","dbName":null}],"dbName":null},"AccessMode":{"values":[{"name":"PUBLIC","dbName":null},{"name":"RESTRICTED","dbName":null}],"dbName":null},"LiveQuizStatus":{"values":[{"name":"PREPARED","dbName":null},{"name":"SCHEDULED","dbName":null},{"name":"RUNNING","dbName":null},{"name":"COMPLETED","dbName":null}],"dbName":null},"ParameterType":{"values":[{"name":"NUMBER","dbName":null},{"name":"STRING","dbName":null}],"dbName":null},"GroupActivityStatus":{"values":[{"name":"DRAFT","dbName":null},{"name":"SCHEDULED","dbName":null},{"name":"PUBLISHED","dbName":null},{"name":"ENDED","dbName":null},{"name":"GRADED","dbName":null}],"dbName":null},"ResponseCorrectness":{"values":[{"name":"CORRECT","dbName":null},{"name":"PARTIAL","dbName":null},{"name":"WRONG","dbName":null}],"dbName":null},"UserRole":{"values":[{"name":"PARTICIPANT","dbName":null},{"name":"USER","dbName":null},{"name":"ADMIN","dbName":null}],"dbName":null},"UserLoginScope":{"values":[{"name":"ACCOUNT_OWNER","dbName":null},{"name":"FULL_ACCESS","dbName":null},{"name":"SESSION_EXEC","dbName":null},{"name":"READ_ONLY","dbName":null},{"name":"OTP","dbName":null},{"name":"ACTIVATION","dbName":null}],"dbName":null},"Locale":{"values":[{"name":"en","dbName":null},{"name":"de","dbName":null}],"dbName":null}},"types":{}}');
    defineDmmfProperty2(exports2.Prisma, config2.runtimeDataModel);
    config2.engineWasm = void 0;
    var { warnEnvConflicts: warnEnvConflicts2 } = require_library();
    warnEnvConflicts2({
      rootEnvPath: config2.relativeEnvPaths.rootEnvPath && path.resolve(config2.dirname, config2.relativeEnvPaths.rootEnvPath),
      schemaEnvPath: config2.relativeEnvPaths.schemaEnvPath && path.resolve(config2.dirname, config2.relativeEnvPaths.schemaEnvPath)
    });
    var PrismaClient4 = getPrismaClient3(config2);
    exports2.PrismaClient = PrismaClient4;
    Object.assign(exports2, Prisma);
    path.join(__dirname, "libquery_engine-darwin-arm64.dylib.node");
    path.join(process.cwd(), "src/prisma/client/libquery_engine-darwin-arm64.dylib.node");
    path.join(__dirname, "libquery_engine-debian-openssl-1.1.x.so.node");
    path.join(process.cwd(), "src/prisma/client/libquery_engine-debian-openssl-1.1.x.so.node");
    path.join(__dirname, "libquery_engine-linux-musl-openssl-3.0.x.so.node");
    path.join(process.cwd(), "src/prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node");
    path.join(__dirname, "libquery_engine-debian-openssl-3.0.x.so.node");
    path.join(process.cwd(), "src/prisma/client/libquery_engine-debian-openssl-3.0.x.so.node");
    path.join(__dirname, "schema.prisma");
    path.join(process.cwd(), "src/prisma/client/schema.prisma");
  }
});

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var import_functions = require("@azure/functions");

// src/getLegacyResults.ts
var import_mongoose = __toESM(require("mongoose"));
var { Schema, Types } = import_mongoose.default;
var { ObjectId } = Types;
var Response = new import_mongoose.default.Schema(
  {
    participant: { type: String, ref: "SessionParticipant" },
    value: { type: Object, required: true }
  },
  { timestamps: true }
);
var Results = new import_mongoose.default.Schema(
  {
    CHOICES: [{ type: Number }],
    FREE: { type: Object },
    totalParticipants: { type: Number, default: 0 }
  },
  { timestamps: true }
);
var LegacyQuestionInstance = new import_mongoose.default.Schema(
  {
    isOpen: { type: Boolean, default: false },
    question: { type: ObjectId, ref: "Question", required: true, index: true },
    session: { type: ObjectId, ref: "Session", required: true, index: true },
    user: { type: ObjectId, ref: "User", required: true, index: true },
    version: { type: Number, min: 0, required: true },
    blockedParticipants: [{ type: String }],
    responses: [{ type: Response }],
    dropped: [{ type: Response }],
    results: { type: Results }
  },
  { timestamps: true }
);
LegacyQuestionInstance.index({ "$**": 1 });
var legacyConnection = import_mongoose.default.createConnection(
  process.env.MIGRATION_LEGACY_MONGO_CONNECTION_STRING,
  {
    dbName: "klicker-prod",
    authSource: "admin",
    keepAlive: true
  }
);
process.on("SIGINT", function() {
  legacyConnection.close();
});
var LegacyQuestionInstanceModel = legacyConnection.model(
  "LegacyQuestionInstance",
  LegacyQuestionInstance,
  "questioninstances"
);
function getLegacyResults(legacyQuestionInstanceId) {
  return __async(this, null, function* () {
    const legacyInstance = yield LegacyQuestionInstanceModel.findById(
      new ObjectId(legacyQuestionInstanceId)
    );
    return legacyInstance ? legacyInstance.results : null;
  });
}
function closeLegacyConnection() {
  legacyConnection.close();
}

// src/importQuestionInstances.ts
var import_prisma = __toESM(require_dist());

// src/utils.ts
var import_axios = __toESM(require("axios"));
function sliceIntoChunks(array, chunkSize) {
  const result = [];
  let index = 0;
  while (index < array.length) {
    result.push(array.slice(index, index + chunkSize));
    index += chunkSize;
  }
  return result;
}
var QuestionTypeMap = {
  SC: "SC",
  MC: "MC",
  FREE_RANGE: "NUMERICAL",
  FREE: "FREE_TEXT"
};
function sendTeamsNotifications(scope, text, context) {
  return __async(this, null, function* () {
    if (process.env.TEAMS_WEBHOOK_URL) {
      try {
        return import_axios.default.post(process.env.TEAMS_WEBHOOK_URL, {
          "@context": "https://schema.org/extensions",
          "@type": "MessageCard",
          themeColor: "0076D7",
          title: `Migration: ${scope}`,
          text: `[${process.env.NODE_ENV}:${scope}] ${text}`
        });
      } catch (e) {
        context.error(e);
      }
    }
    return null;
  });
}
function sendEmailMigrationNotification(email, success, context) {
  return __async(this, null, function* () {
    const LISTMONK_AUTH = {
      username: process.env.LISTMONK_USER,
      password: process.env.LISTMONK_PASS
    };
    try {
      yield import_axios.default.post(
        `${process.env.LISTMONK_URL}/api/subscribers`,
        {
          email,
          name: email,
          status: "enabled",
          preconfirm_subscriptions: true
        },
        { auth: LISTMONK_AUTH }
      );
    } catch (e) {
      context.error(e);
    }
    try {
      const result = import_axios.default.post(
        `${process.env.LISTMONK_URL}/api/tx`,
        {
          subscriber_emails: [email],
          template_id: success ? Number(process.env.LISTMONK_TEMPLATE_MIGRATION_SUCCESS) : Number(process.env.LISTMONK_TEMPLATE_MIGRATION_FAILED)
        },
        { auth: LISTMONK_AUTH }
      );
      context.log(result);
      return result;
    } catch (e) {
      context.error(e);
    }
    return null;
  });
}

// src/importQuestionInstances.ts
var importQuestionInstances = (prisma3, importedQuestionInstances, mappedQuestionIds, user, batchSize, context) => __async(void 0, null, function* () {
  try {
    let mappedQuestionInstancesIds = {};
    const questions = yield prisma3.element.findMany({
      where: {
        id: {
          in: Object.values(mappedQuestionIds)
        },
        owner: {
          id: user.id
        }
      }
    });
    const questionInstancesInDb = yield prisma3.questionInstance.findMany({
      where: {
        originalId: {
          not: null
        },
        owner: {
          id: user.id
        }
      }
    });
    const questionInstancesDict = questionInstancesInDb.reduce(
      (acc, qi2) => __spreadProps(__spreadValues({}, acc), {
        [qi2.originalId]: qi2
      }),
      {}
    );
    const batches = sliceIntoChunks(importedQuestionInstances, 10);
    let lostResults = [];
    for (const batch of batches) {
      const preparedQuestionInstances = (yield Promise.allSettled(
        batch.map((questionInstance) => __async(void 0, null, function* () {
          var _a2;
          const questionInstanceExists = questionInstancesDict[questionInstance._id];
          if (questionInstanceExists) {
            mappedQuestionInstancesIds[questionInstance._id] = questionInstanceExists.id;
            return null;
          }
          let questionData = {};
          let questionId = null;
          const question = questions.find(
            (question2) => question2.id === mappedQuestionIds[questionInstance.question]
          );
          if (question) {
            questionId = question.id;
            questionData = __spreadProps(__spreadValues({}, question), {
              id: `${questionId}-v1`,
              questionId
            });
          }
          if (questionInstance.results && !questionInstance.results.CHOICES && !questionInstance.results.FREE) {
            questionInstance.results = yield getLegacyResults(
              questionInstance._id
            );
            if (questionInstance.results == null) {
              lostResults.push(questionInstance);
            }
          }
          let results = {};
          if (question && questionInstance.results) {
            if (questionData.type === "SC" || questionData.type === "MC") {
              if (questionInstance.results.CHOICES) {
                results = questionInstance.results.CHOICES.reduce(
                  (acc, choice, idx) => {
                    acc[idx.toString()] = {
                      count: choice,
                      value: idx.toString()
                    };
                    return acc;
                  },
                  {}
                );
              }
            } else if (questionData.type === QuestionTypeMap["FREE"] || questionData.type === QuestionTypeMap["FREE_RANGE"]) {
              if (questionInstance.results.FREE) {
                let newResults = Object.keys(
                  questionInstance.results.FREE
                ).reduce((acc, hash) => {
                  acc[hash] = questionInstance.results.FREE[hash];
                  return acc;
                }, {});
                results = __spreadValues(__spreadValues({}, results), newResults);
              } else if (questionInstance.results.FREE_RANGE) {
                let newResults = Object.keys(
                  questionInstance.results.FREE_RANGE
                ).reduce((acc, hash) => {
                  acc[hash] = questionInstance.results.FREE_RANGE[hash];
                  return acc;
                }, {});
                results = __spreadValues(__spreadValues({}, results), newResults);
              }
            }
          }
          return {
            originalId: questionInstance._id,
            type: import_prisma.QuestionInstanceType.SESSION,
            questionData,
            participants: (_a2 = questionInstance.results) == null ? void 0 : _a2.totalParticipants,
            results,
            owner: {
              connect: {
                id: user.id
              }
            },
            question: questionId ? {
              connect: {
                id: questionId
              }
            } : void 0,
            createdAt: new Date(questionInstance.createdAt),
            updatedAt: new Date(questionInstance.updatedAt)
          };
        }))
      )).flatMap((result) => {
        if (result.status === "fulfilled") {
          if (result.value !== null) {
            return [result.value];
          }
        }
        return [];
      });
      yield Promise.all(
        preparedQuestionInstances.map(
          (questionInstance) => prisma3.$transaction((prisma4) => __async(void 0, null, function* () {
            const newQuestionInstance = yield prisma4.questionInstance.create({
              data: questionInstance
            });
            mappedQuestionInstancesIds[questionInstance.originalId] = newQuestionInstance.id;
            if (questionInstance.questionData.id) {
              yield prisma4.element.update({
                where: {
                  id: questionInstance.questionData.questionId
                },
                data: {
                  instances: {
                    connect: {
                      id: newQuestionInstance.id
                    }
                  }
                }
              });
            }
          }))
        )
      );
    }
    context.log("mappedQuestionInstancesIds", mappedQuestionInstancesIds);
    context.log("lostResults.length: ", lostResults.length);
    return mappedQuestionInstancesIds;
  } catch (error) {
    context.error(
      "Something went wrong while importing question instances: ",
      error
    );
    yield sendTeamsNotifications(
      "func/migration-v3-import",
      `Failed migration of question instances for user '${user.email}' because of ${error}`,
      context
    );
    throw error;
  }
});

// src/importQuestions.ts
var importQuestions = (prisma3, importedQuestions, mappedTags, user, batchSize, mappedFileURLs, context) => __async(void 0, null, function* () {
  try {
    let mappedQuestionIds = {};
    const questionsInDb = yield prisma3.element.findMany({
      where: {
        originalId: {
          not: null
        },
        owner: {
          id: user.id
        }
      }
    });
    const questionsDict = questionsInDb.reduce(
      (acc, cur) => __spreadProps(__spreadValues({}, acc), {
        [cur.originalId]: cur
      }),
      {}
    );
    const batches = sliceIntoChunks(importedQuestions, 20);
    for (const batch of batches) {
      const preparedQuestions = batch.flatMap((question) => {
        var _a2, _b;
        const questionExists = questionsDict[question._id];
        if (questionExists) {
          mappedQuestionIds[question._id] = questionExists.id;
          return [];
        }
        const result = {
          data: {
            originalId: question._id,
            name: question.title,
            type: QuestionTypeMap[question.type],
            content: question.versions.content + (((_a2 = question.versions.files) == null ? void 0 : _a2.length) > 0 ? "\n" + question.versions.files.map(
              (fileId) => `![${mappedFileURLs[fileId].originalName}](${mappedFileURLs[fileId].url})`
            ).join("\n\n") + "\n" : ""),
            options: {
              displayMode: question.type == "SC" || question.type == "MC" ? "LIST" : void 0,
              hasSampleSolution: false,
              hasAnswerFeedbacks: false,
              choices: void 0,
              restrictions: void 0,
              solutions: void 0,
              solutionRanges: void 0
            },
            isDeleted: question.isDeleted,
            isArchived: question.isArchived,
            tags: {
              connect: question.tags.flatMap((oldTagId) => {
                if (!mappedTags[oldTagId]) {
                  context.log("Tag not found: ", oldTagId);
                  return [];
                }
                const tagName = mappedTags[oldTagId].name;
                return [
                  {
                    ownerId_name: {
                      ownerId: user.id,
                      name: tagName
                    }
                  }
                ];
              })
            },
            owner: {
              connect: {
                id: user.id
              }
            },
            createdAt: new Date(question.createdAt),
            updatedAt: new Date(question.updatedAt)
          }
        };
        if (["SC", "MC"].includes(question.type)) {
          result.data.options = __spreadProps(__spreadValues({}, result.data.options), {
            hasSampleSolution: question.versions.options[question.type].choices.some((choice) => choice.correct),
            choices: question.versions.options[question.type].choices.map(
              (choice, ix) => {
                return {
                  ix,
                  value: choice.name,
                  correct: choice.correct,
                  feedback: ""
                };
              }
            )
          });
        } else if (question.type === "FREE_RANGE") {
          const restrictions = (_b = question.versions.options.FREE_RANGE) == null ? void 0 : _b.restrictions;
          if (!restrictions) {
            result.data.options = __spreadProps(__spreadValues({}, result.data.options), {
              restrictions: void 0,
              solutions: [],
              solutionRanges: []
            });
          } else {
            result.data.options = __spreadProps(__spreadValues({}, result.data.options), {
              restrictions: {
                min: restrictions.min !== null ? restrictions.min : void 0,
                max: restrictions.max !== null ? restrictions.max : void 0
              },
              solutions: [],
              solutionRanges: []
            });
          }
        } else if (question.type === "FREE") {
          result.data.options = __spreadProps(__spreadValues({}, result.data.options), {
            restrictions: {},
            solutions: []
          });
        } else {
          return [];
        }
        return [result];
      });
      const createdQuestions = yield prisma3.$transaction(
        preparedQuestions.map((data) => prisma3.element.create(data))
      );
      createdQuestions.forEach((question) => {
        mappedQuestionIds[question.originalId] = question.id;
      });
    }
    context.log("mappedQuestionIds: ", mappedQuestionIds);
    return mappedQuestionIds;
  } catch (error) {
    context.error("Something went wrong while importing questions: ", error);
    yield sendTeamsNotifications(
      "func/migration-v3-import",
      `Failed migration of questions for user '${user.email}' because of ${error}`,
      context
    );
    throw error;
  }
});

// src/importSessions.ts
var import_prisma2 = __toESM(require_dist());
var getSessionBlockStatus = (status) => {
  switch (status) {
    case "PLANNED":
      return import_prisma2.SessionBlockStatus.SCHEDULED;
    case "ACTIVE":
      return import_prisma2.SessionBlockStatus.ACTIVE;
    case "EXECUTED":
      return import_prisma2.SessionBlockStatus.EXECUTED;
  }
};
var getSessionStatus = (status) => {
  switch (status) {
    case "CREATED":
      return import_prisma2.SessionStatus.PREPARED;
    case "COMPLETED":
      return import_prisma2.SessionStatus.COMPLETED;
    default:
      return null;
  }
};
var importSessions = (prisma3, importedSessions, mappedQuestionInstanceIds, user, batchSize, context) => __async(void 0, null, function* () {
  try {
    let mappedSessionIds = {};
    const sessionsInDb = yield prisma3.liveSession.findMany({
      where: {
        originalId: {
          not: null
        },
        owner: {
          id: user.id
        }
      }
    });
    const sessionsDict = sessionsInDb.reduce((acc, s) => {
      if (s.originalId != null) {
        acc[s.originalId] = s;
      }
      return acc;
    }, {});
    const batches = sliceIntoChunks(importedSessions, 10);
    for (const batch of batches) {
      const preparedSessions = batch.flatMap((session) => {
        const sessionExists = sessionsDict[session._id];
        const sessionStatus = getSessionStatus(session.status);
        if (!sessionStatus) {
          return [];
        }
        return [
          {
            sessionExists,
            originalData: session,
            prismaData: {
              data: {
                originalId: session._id,
                namespace: session.namespace,
                name: session.name,
                displayName: session.name,
                // no displayName in v2
                accessMode: session.settings.isParticipantAuthenticationEnabled ? import_prisma2.AccessMode.RESTRICTED : import_prisma2.AccessMode.PUBLIC,
                isConfusionFeedbackEnabled: session.settings.isConfusionBarometerActive,
                isLiveQAEnabled: session.settings.isFeedbackChannelActive,
                isModerationEnabled: !session.settings.isFeedbackChannelPublic,
                status: sessionStatus,
                // imported sessions will either be prepared or completed (no active or paused sessions)
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
                startedAt: session.startedAt ? new Date(session.startedAt) : null,
                finishedAt: session.finishedAt ? new Date(session.finishedAt) : null,
                // activeBlock: difference 0 and -1? e.g., -1 == nicht gestartet and 0 is first element of list? -->!! null? da keine session "running" sein wird
                // blocks: check SessionBlock -> activeInSession ?? --> NO active sessions will be imported!
                // no activeSteps in v3 -> sessions will either be prepared or completed
                // no activeInstances: QuestionInstance[] in v3 kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
                // activeInstances? only one possible in v3? kein link da nichts mehr aktiv sein wird: sessions will either be prepared or completed
                owner: {
                  connect: {
                    id: user.id
                  }
                },
                // nested writes for entities that have not circular dependencies
                feedbacks: !!session.isBeta ? {
                  create: session.feedbacks.map((feedback) => ({
                    content: feedback.content,
                    votes: feedback.votes,
                    createdAt: new Date(feedback.createdAt)
                  }))
                } : {
                  create: session.feedbacks.map((feedback) => {
                    var _a2;
                    return {
                      isPublished: feedback.published,
                      isPinned: feedback.pinned,
                      isResolved: feedback.resolved,
                      votes: feedback.votes,
                      content: feedback.content,
                      responses: {
                        create: (_a2 = feedback.responses) == null ? void 0 : _a2.map((response) => ({
                          content: response.content,
                          positiveReactions: response.positiveReactions,
                          negativeReactions: response.negativeReactions,
                          createdAt: new Date(response.createdAt),
                          updatedAt: new Date(response.updatedAt)
                        }))
                      },
                      createdAt: new Date(feedback.createdAt),
                      updatedAt: new Date(feedback.updatedAt)
                    };
                  })
                },
                confusionFeedbacks: {
                  create: session.confusionTS.map((confusionFeedback) => ({
                    difficulty: confusionFeedback.difficulty,
                    speed: confusionFeedback.speed,
                    createdAt: new Date(confusionFeedback.createdAt)
                  }))
                },
                blocks: {
                  create: session.blocks.map((sessionBlock, blockIx) => {
                    const instances = sessionBlock.instances.map(
                      (instanceId) => ({
                        id: mappedQuestionInstanceIds[instanceId]
                      })
                    );
                    return {
                      originalId: sessionBlock._id,
                      order: blockIx,
                      randomSelection: sessionBlock.randomSelection !== -1 ? sessionBlock.randomSelection : null,
                      timeLimit: sessionBlock.timeLimit !== -1 ? sessionBlock.timeLimit : null,
                      execution: sessionBlock.execution !== -1 ? sessionBlock.execution : 0,
                      status: getSessionBlockStatus(sessionBlock.status),
                      instances: {
                        connect: instances
                      },
                      createdAt: new Date(sessionBlock.createdAt),
                      updatedAt: new Date(sessionBlock.updatedAt)
                    };
                  })
                }
              },
              include: {
                blocks: {
                  include: {
                    instances: true
                  }
                }
              }
            }
          }
        ];
      });
      yield Promise.allSettled(
        preparedSessions.map(
          (_0) => __async(void 0, [_0], function* ({ sessionExists, originalData, prismaData }) {
            return prisma3.$transaction((prisma4) => __async(void 0, null, function* () {
              var _a2;
              const createdSession = sessionExists ? yield prisma4.liveSession.update({
                where: {
                  id: sessionExists.id
                },
                data: prismaData.data,
                include: {
                  blocks: {
                    include: {
                      instances: true
                    }
                  }
                }
              }) : yield prisma4.liveSession.create({
                data: prismaData.data,
                include: {
                  blocks: {
                    include: {
                      instances: true
                    }
                  }
                }
              });
              mappedSessionIds[createdSession.originalId] = createdSession.id;
              for (const block of createdSession.blocks) {
                if (!block || !block.instances) {
                  continue;
                }
                const reducedOldBlocks = originalData.blocks.reduce(
                  (acc, block2) => {
                    acc[block2._id] = block2;
                    return acc;
                  },
                  {}
                );
                for (const instance of block.instances) {
                  const oldBlock = reducedOldBlocks[block.originalId];
                  const i = (_a2 = oldBlock == null ? void 0 : oldBlock.instances) == null ? void 0 : _a2.findIndex(
                    (id2) => id2 === instance.originalId
                  );
                  let updateData = {
                    sessionBlockId: block.id
                  };
                  if (i || i === 0) {
                    updateData["order"] = i;
                  }
                  yield prisma4.questionInstance.update({
                    where: { id: instance.id },
                    data: updateData
                  });
                }
              }
            }));
          })
        )
      );
    }
    context.log("mappedSessionIds", mappedSessionIds);
    return mappedSessionIds;
  } catch (error) {
    context.error("Something went wrong while importing sessions: ", error);
    yield sendTeamsNotifications(
      "func/migration-v3-import",
      `Failed migration of sessions for user '${user.email}' because of ${error}`,
      context
    );
    throw error;
  }
});

// src/importTags.ts
function importTags(prisma3, tags, user, batchSize, context) {
  return __async(this, null, function* () {
    try {
      let mappedTags = {};
      const tagsInDb = yield prisma3.tag.findMany({
        where: {
          originalId: {
            not: null
          },
          owner: {
            id: user.id
          }
        }
      });
      const tagsDict = tagsInDb.reduce(
        (acc, t) => __spreadProps(__spreadValues({}, acc), {
          [t.originalId]: t
        }),
        {}
      );
      const tagsNameDict = tagsInDb.reduce(
        (acc, t) => __spreadProps(__spreadValues({}, acc), {
          [t.name]: t
        }),
        {}
      );
      const batches = sliceIntoChunks(tags, 20);
      for (const batch of batches) {
        const preparedTags = batch.flatMap((tag) => {
          const tagExistsById = tagsDict[tag._id];
          const tagExistsByName = tagsNameDict[tag.name];
          if (tagExistsById) {
            mappedTags[tag._id] = {
              id: tagExistsById.id,
              name: tagExistsById.name
            };
            return [];
          }
          if (tagExistsByName) {
            mappedTags[tag._id] = {
              id: tagExistsByName.id,
              name: tagExistsByName.name
            };
            return [];
          }
          return [
            {
              where: {
                ownerId_name: {
                  ownerId: user.id,
                  name: tag.name
                }
              },
              update: {},
              create: {
                name: tag.name,
                originalId: tag._id,
                owner: {
                  connect: {
                    id: user.id
                  }
                },
                createdAt: new Date(tag.createdAt),
                updatedAt: new Date(tag.updatedAt)
              }
            }
          ];
        });
        const migratedTags = yield prisma3.$transaction(
          preparedTags.map((data) => prisma3.tag.upsert(data))
        );
        migratedTags.forEach((tag) => {
          mappedTags[tag.originalId] = { id: tag.id, name: tag.name };
        });
      }
      context.log("mappedTags: ", mappedTags);
      const userWithTags = yield prisma3.user.findUnique({
        where: {
          id: user.id
        },
        select: {
          tags: {
            orderBy: {
              name: "asc"
            }
          }
        }
      });
      const [orderedTags, totalTags] = yield prisma3.$transaction(
        userWithTags.tags.map(
          (tag, index) => prisma3.tag.update({
            where: {
              id: tag.id
            },
            data: {
              order: index
            }
          })
        )
      );
      console.log("ordered tags: ", orderedTags);
      return mappedTags;
    } catch (error) {
      context.error("Something went wrong while importing tags: ", error);
      yield sendTeamsNotifications(
        "func/migration-v3-import",
        `Failed migration of tags for user '${user.email}' because of ${error}`,
        context
      );
      throw error;
    }
  });
}

// src/migrateFiles.ts
var import_axios2 = __toESM(require("axios"));
var import_uuid = require("uuid");

// src/blob.ts
var import_storage_blob = require("@azure/storage-blob");
function getBlobClient(context, userId) {
  return __async(this, null, function* () {
    const blobServiceClient = new import_storage_blob.BlobServiceClient(
      process.env.MIGRATION_BLOB_IMPORT_IMAGES_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(userId);
    if (!(yield containerClient.exists())) {
      yield containerClient.create({
        access: "blob"
      });
    }
    return containerClient;
  });
}
var blob_default = getBlobClient;

// src/migrateFiles.ts
var migrateFiles = (prisma3, files, context, user) => __async(void 0, null, function* () {
  try {
    let mappedFileURLs = {};
    const blobClient = yield blob_default(context, user.id);
    for (const file of files) {
      const response = yield import_axios2.default.get(
        `https://tc-klicker-prod.s3.amazonaws.com/images/${file.name}`,
        { responseType: "arraybuffer" }
      );
      const id2 = (0, import_uuid.v5)(file.name, "3cbe686d-2d38-4494-9de2-28046b6241c4");
      const extension = file.originalName.split(".").pop();
      const blockBlobClient = blobClient.getBlockBlobClient(
        `${id2}.${extension}`
      );
      try {
        yield prisma3.mediaFile.create({
          data: {
            id: id2,
            name: file.originalName,
            type: "migrated",
            href: blockBlobClient.url.split("?")[0],
            originalId: file._id,
            owner: {
              connect: {
                id: user.id
              }
            }
          }
        });
        context.log(
          `Uploading file ${file.originalName} to ${blockBlobClient.url}`
        );
        yield blockBlobClient.uploadData(response.data, {
          blockSize: 4 * 1024 * 1024
          // 4MB block size
        });
      } catch (e) {
        if (!e.message.includes("Unique constraint failed")) {
          throw e;
        }
      }
      const publicUrl = blockBlobClient.url.split("?")[0];
      mappedFileURLs[file._id] = {
        id: id2,
        url: publicUrl,
        originalName: file.originalName
      };
    }
    return mappedFileURLs;
  } catch (error) {
    context.error("Something went wrong while migrating files: ", error);
    yield sendTeamsNotifications(
      "func/migration-v3-import",
      `Failed migration of images for user '${user.email}'`,
      context
    );
    throw error;
  }
});

// src/prisma.ts
var import_prisma3 = __toESM(require_dist());
var prisma;
function getPrismaClient2(context) {
  if (!prisma) {
    try {
      prisma = new import_prisma3.PrismaClient();
    } catch (e) {
      context == null ? void 0 : context.error(e);
    }
  }
  return prisma;
}
var prisma_default = getPrismaClient2;

// src/index.ts
var prisma2 = prisma_default();
var blobTrigger = function(blob, context) {
  return __async(this, null, function* () {
    var _a2, _b, _c2;
    let email = "";
    try {
      const data = blob;
      const content = data.toString();
      context.log((_a2 = context.triggerMetadata) == null ? void 0 : _a2.blobTrigger);
      const newUserId = (((_b = context.triggerMetadata) == null ? void 0 : _b.blobTrigger) ? (_c2 = context.triggerMetadata) == null ? void 0 : _c2.blobTrigger : void 0).split("/")[process.env.NODE_ENV === "development" ? 1 : 2].split("_")[0];
      const parsedContent = JSON.parse(content);
      context.log(
        `MigrationV3Import function processing a new exported blob with originalEmail: ${parsedContent["user_email"]} and new user id: ${newUserId}`
      );
      const user = yield prisma2.user.findUnique({
        where: {
          id: newUserId
        }
      });
      if (!user) {
        throw new Error("User not found");
      }
      email = user.email;
      yield sendTeamsNotifications(
        "func/migration-v3-import",
        `Started import of KlickerV2 data for user '${user.email}'`,
        context
      );
      let mappedTags = {};
      let mappedFileURLs = {};
      let mappedQuestionIds = {};
      let mappedQuestionInstancesIds = {};
      let mappedSessionIds = {};
      mappedFileURLs = yield migrateFiles(
        prisma2,
        parsedContent.files,
        context,
        user
      );
      const batchSize = 10;
      const tags = parsedContent.tags;
      mappedTags = yield importTags(prisma2, tags, user, batchSize, context);
      const questions = parsedContent.questions;
      mappedQuestionIds = yield importQuestions(
        prisma2,
        questions,
        mappedTags,
        user,
        batchSize,
        mappedFileURLs,
        context
      );
      const questionInstances = parsedContent.questioninstances;
      mappedQuestionInstancesIds = yield importQuestionInstances(
        prisma2,
        questionInstances,
        mappedQuestionIds,
        user,
        batchSize,
        context
      );
      const sessions = parsedContent.sessions;
      mappedSessionIds = yield importSessions(
        prisma2,
        sessions,
        mappedQuestionInstancesIds,
        user,
        batchSize,
        context
      );
      yield sendTeamsNotifications(
        "func/migration-v3-import",
        `Successful import for user '${user.email}'`,
        context
      );
      yield sendEmailMigrationNotification(user.email, true, context);
    } catch (e) {
      context.error("Something went wrong while importing data: ", e);
      yield sendTeamsNotifications(
        "func/migration-v3-import",
        `Import of KlickerV2 data failed. Error: ${e.message}`,
        context
      );
      yield sendEmailMigrationNotification(email, false, context);
      throw new Error("Something went wrong while importing data");
    } finally {
      yield closeLegacyConnection();
      yield prisma2.$disconnect();
    }
  });
};
var src_default = blobTrigger;
import_functions.app.storageBlob("MigrationV3Import", {
  connection: "MIGRATION_BLOB_IMPORT_CONNECTION_STRING",
  path: "exports",
  handler: blobTrigger
});
/*! Bundled license information:

decimal.js/decimal.mjs:
  (*!
   *  decimal.js v10.4.3
   *  An arbitrary-precision Decimal type for JavaScript.
   *  https://github.com/MikeMcl/decimal.js
   *  Copyright (c) 2022 Michael Mclaughlin <M8ch88l@gmail.com>
   *  MIT Licence
   *)
*/
