# 52. Learner code runs in an opaque, network-less runner served from the Chat origin

## Status

Accepted.

## Context

Coding courses want learners to edit and run short Python and R programs from
the Chat thread, without a server-side execution service. Pyodide and webR run
CPython and R as WebAssembly in the browser. Learner code is untrusted from
Chat's point of view, though. It must not read the Chat session, call Chat
APIs with the learner's cookies, or send code, output or data anywhere.

A browser qualification compared two ways to load the runtimes into a sandboxed
frame. Loading them from an asset origin leaked request URLs to that host on
every engine. Loading them through a host-side broker that hands the runner
verified bytes met a strict no-egress contract on Chromium and WebKit. Firefox
workers still reached the network through `EventSource` and `FontFace` despite
the runner's CSP, and removing those APIs from the worker broke webR.

## Decision

Learner code runs in a runner document that is opaque, has no network access
and receives every runtime file from the Chat page.

- **Origin.** Chat serves the runner documents from its own origin under
  `/code-runtimes/<version>/`. Two mechanisms make the document's origin
  opaque: the iframe attribute `sandbox="allow-scripts"`, and a response CSP
  `sandbox allow-scripts` that also applies when the URL is opened directly.
  The opaque runner cannot read Chat cookies or storage, and its requests carry
  no Chat credentials.
- **Network.** The runner CSP allows no network scheme: `default-src 'none'`,
  the hash of the inline bootstrap, and `blob:` for scripts, workers and
  connections. Only the R runner adds `'unsafe-eval'`, because webR evaluates
  JavaScript strings.
- **Runtime files.** The Chat page fetches every runtime file, checks its
  SHA-256 against a checked-in manifest and transfers the bytes to the runner.
  The build copies the files from exact-pinned `pyodide` and `webr` packages
  and fails on any mismatch with the manifest. The manifest content determines
  the version path segment, so the files can be cached as immutable.
- **Bridge.** The host hands the runner a private `MessageChannel` port once,
  and ignores `window` messages. It validates every port message by version,
  shape, size, attempt and generation. It caps output and message counts, and
  it assigns the provenance of every result itself.
- **Lifecycle.** Each run builds a fresh runner, so interpreter state never
  leaks between runs. Stop, timeout and reset remove the frame.
- **Gating.** A deployment kill switch, `CHAT_CODE_EXECUTION_ENABLED`, and a
  platform-owned per-mode chatbot policy must both admit a profile. While the
  switch is off, the Chat proxy answers 404 for `/code-runtimes/`. The proxy
  also sets the runtime files' headers at request time, because build-time
  Next.js headers cannot read the runtime environment and the proxy's
  `frame-ancestors` policy would otherwise replace them.
- **Browsers.** Chromium-based browsers and WebKit are supported. Firefox and
  unknown engines show an unavailable notice until a stock release passes the
  qualification harness again. There is no server fallback.

## Consequences

- Program code cannot reach Chat APIs or third parties on the supported
  engines, and running costs no server or model capacity.
- The Chat image carries about 64 MB of runtime files even while the feature
  is off. The image ships the webR binary licence (GPL-3.0) and a pointer to
  the corresponding sources; Pyodide is MPL-2.0.
- Firefox learners cannot run code until Firefox is re-qualified.
- Only the Pyodide standard library and base R are available. Package
  profiles need their own pinned artifact pipeline.
- Moving runtime hosting to a separate static origin or CDN is a deployment
  decision for execution infrastructure; the broker and runner contract stays
  the same.
