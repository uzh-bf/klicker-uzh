# Realtime Voice Chat

Connect a realtime voice backend (ElevenLabs, LiveKit, OpenAI Realtime, etc.) to assistant-ui via a `RealtimeVoiceAdapter`.

## Contents

- [Configuration](#configuration)
- [useVoiceState](#usevoicestate)
- [useVoiceControls](#usevoicecontrols)
- [useVoiceVolume](#usevoicevolume)
- [UI Controls](#ui-controls)
- [RealtimeVoiceAdapter Interface](#realtimevoiceadapter-interface)
- [createVoiceSession Helper](#createvoicesession-helper)
- [Status, Mode, and Transcript Types](#status-mode-and-transcript-types)
- [Transcript Handling](#transcript-handling)
- [ElevenLabs Example](#elevenlabs-example)
- [LiveKit Example](#livekit-example)

## Configuration

Pass an adapter via `adapters.voice`. When provided, `capabilities.voice` is automatically set to `true`.

```ts
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

const runtime = useChatRuntime({
  adapters: {
    voice: new MyVoiceAdapter({ /* ... */ }),
  },
});
```

All voice hooks and types come from `@assistant-ui/react`:

```ts
import {
  useVoiceState,
  useVoiceControls,
  useVoiceVolume,
  createVoiceSession,
} from "@assistant-ui/react";
import type { RealtimeVoiceAdapter } from "@assistant-ui/react";
```

## useVoiceState

Returns the current session state, or `undefined` when no session is active.

```ts
const voiceState = useVoiceState();

voiceState?.status.type; // "starting" | "running" | "ended"
voiceState?.isMuted;     // boolean
voiceState?.mode;        // "listening" | "speaking"
```

```tsx
function VoiceStatus() {
  const voiceState = useVoiceState();
  if (!voiceState) return <span>Idle</span>;

  if (voiceState.status.type === "starting") return <span>Connecting…</span>;
  if (voiceState.status.type === "ended") return <span>Ended</span>;
  return <span>{voiceState.mode === "speaking" ? "Assistant speaking" : "Listening"}</span>;
}
```

## useVoiceControls

Imperative session controls. `connect` starts a session; the rest act on the active one.

```ts
const { connect, disconnect, mute, unmute } = useVoiceControls();
// connect: () => void
// disconnect: () => void
// mute: () => void
// unmute: () => void
```

## useVoiceVolume

Real time audio level on its own subscription, a number from `0` to `1`. Kept separate from `useVoiceState` so high frequency volume updates do not re-render state consumers.

```tsx
function VolumeBar() {
  const volume = useVoiceVolume(); // 0 to 1
  return <div style={{ width: `${volume * 100}%` }} className="volume-fill" />;
}
```

## UI Controls

```tsx
function VoiceControls() {
  const voiceState = useVoiceState();
  const { connect, disconnect, mute, unmute } = useVoiceControls();

  const isRunning = voiceState?.status.type === "running";
  const isStarting = voiceState?.status.type === "starting";
  const isMuted = voiceState?.isMuted ?? false;

  if (!isRunning && !isStarting) {
    return (
      <button onClick={() => connect()}>
        <PhoneIcon /> Connect
      </button>
    );
  }

  return (
    <>
      <button onClick={() => (isMuted ? unmute() : mute())} disabled={!isRunning}>
        {isMuted ? <MicOffIcon /> : <MicIcon />}
      </button>
      <button onClick={() => disconnect()}>
        <PhoneOffIcon /> Disconnect
      </button>
    </>
  );
}
```

## RealtimeVoiceAdapter Interface

An adapter's `connect` returns a `RealtimeVoiceAdapter.Session`. Each `on*` method registers a callback and returns its unsubscribe function.

```ts
class MyVoiceAdapter implements RealtimeVoiceAdapter {
  connect(options: { abortSignal?: AbortSignal }): RealtimeVoiceAdapter.Session {
    return {
      get status() { /* RealtimeVoiceAdapter.Status */ },
      get isMuted() { /* boolean */ },
      disconnect: () => { /* ... */ },
      mute: () => { /* ... */ },
      unmute: () => { /* ... */ },
      onStatusChange: (callback) => {
        // { type: "starting" } -> { type: "running" } -> { type: "ended", reason }
        return () => {}; // unsubscribe
      },
      onTranscript: (callback) => {
        // callback({ role: "user" | "assistant", text: "...", isFinal: true })
        return () => {};
      },
      onModeChange: (callback) => {
        // callback("listening") | callback("speaking")
        return () => {};
      },
      onVolumeChange: (callback) => {
        // callback(0.72)
        return () => {};
      },
    };
  }
}
```

## createVoiceSession Helper

`createVoiceSession` removes the manual `Set<callback>` bookkeeping of implementing `Session` by hand. It takes the `connect` options and an async setup function that receives `helpers` and returns the session controls (`disconnect`, `mute`, `unmute`).

Signature:

```ts
createVoiceSession(
  options: { abortSignal?: AbortSignal },
  setup: (helpers: VoiceSessionHelpers) => Promise<VoiceSessionControls>,
): RealtimeVoiceAdapter.Session;
```

`helpers` (`VoiceSessionHelpers`):

```ts
helpers.setStatus(status: RealtimeVoiceAdapter.Status): void;
helpers.end(reason: "finished" | "cancelled" | "error", error?: unknown): void;
helpers.emitTranscript(item: RealtimeVoiceAdapter.TranscriptItem): void;
helpers.emitMode(mode: RealtimeVoiceAdapter.Mode): void;
helpers.emitVolume(volume: number): void;
helpers.isDisposed(): boolean;
```

Usage:

```ts
export class MyVoiceAdapter implements RealtimeVoiceAdapter {
  connect(options: { abortSignal?: AbortSignal }): RealtimeVoiceAdapter.Session {
    return createVoiceSession(options, async (helpers) => {
      const client = await MyVoiceClient.connect();

      client.on("open", () => helpers.setStatus({ type: "running" }));
      client.on("close", () => helpers.end("finished"));
      client.on("error", (err) => helpers.end("error", err));
      client.on("transcript", (item) => helpers.emitTranscript(item));
      client.on("mode", (mode) => helpers.emitMode(mode));
      client.on("volume", (v) => helpers.emitVolume(v));

      return {
        disconnect: () => client.close(),
        mute: () => client.setMuted(true),
        unmute: () => client.setMuted(false),
      };
    });
  }
}
```

Note: `helpers.isDisposed()` reports whether the session has ended or its `abortSignal` fired; guard late async work with it before emitting.

## Status, Mode, and Transcript Types

```ts
// RealtimeVoiceAdapter.Status
type Status =
  | { type: "starting" }
  | { type: "running" }
  | { type: "ended"; reason: "finished" | "cancelled" | "error"; error?: unknown };

// RealtimeVoiceAdapter.Mode
type Mode = "listening" | "speaking";

// RealtimeVoiceAdapter.TranscriptItem
interface TranscriptItem {
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
}
```

The session lifecycle moves `starting -> running -> ended`. The `VoiceSessionState` exposed by `useVoiceState` adds `isMuted` and `mode` alongside `status`.

## Transcript Handling

assistant-ui turns emitted transcripts into thread messages:

- User transcripts (`role: "user"`, `isFinal: true`) are appended as user messages.
- Assistant transcripts (`role: "assistant"`) are streamed into an assistant message with `running` status until `isFinal: true` marks it complete.

## ElevenLabs Example

```bash
npm install @elevenlabs/client
```

Wire the ElevenLabs conversation callbacks to the session helpers inside the adapter: `onConnect` -> `setStatus({ type: "running" })`, `onDisconnect` -> `end("finished")`, `onError` -> `end("error", error)`, `onModeChange` -> `emitMode("speaking" | "listening")`, and `onMessage` -> `emitTranscript({ role, text, isFinal: true })`.

```ts
import { ElevenLabsVoiceAdapter } from "@/lib/elevenlabs-voice-adapter";

const runtime = useChatRuntime({
  adapters: {
    voice: new ElevenLabsVoiceAdapter({
      agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
    }),
  },
});
```

## LiveKit Example

```bash
npm install livekit-client livekit-server-sdk
```

Mint the access token server side and pass an async `token` resolver to the adapter.

```ts
import { LiveKitVoiceAdapter } from "@/lib/livekit-voice-adapter";

const runtime = useChatRuntime({
  adapters: {
    voice: new LiveKitVoiceAdapter({
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL!,
      token: async () => {
        const res = await fetch("/api/livekit-token", { method: "POST" });
        const { token } = await res.json();
        return token;
      },
    }),
  },
});
```
