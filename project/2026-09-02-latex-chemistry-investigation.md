# Chemistry and biology visuals in the editor, display, and chatbot

Date: 2026-09-02

Refreshed: 2026-09-03

Execution update, 2026-09-05: the [first prototype results](2026-09-05-scientific-visuals-prototype-results.md)
supersede untested feasibility claims below. Small-molecule/reaction rendering
works locally. Biomolecular KET imports need a pinned monomer library and the
document API; generic PNG layout is not a qualified sequence presentation.
Ketcher's standalone build succeeds with browser shims, while editor readiness
remains inconclusive. The proposed media lifecycle needs external-write fencing.
The [current plan](plans_wip/2026-09-03-scientific-visuals-plan.md) records senior
review and the authorized local experiment boundary. September 3 source/version
statements below remain historical unless explicitly refreshed there.

Inspected branch baseline: `7f55d17e03035a54d966f80655d90a6f2282f22a`

Latest checked `origin/v3`: `afba9120512cdd6d6ba43cc87997520a3a0d0a1a`
(nine newer commits; the chatbot-authoring work substantially changes
`ContentInput.tsx` but preserves the existing Markdown, LaTeX, and Slate
contracts used by this investigation. The two later practice-pool and chatbot
evaluation commits do not change the relevant Markdown or participant Chat
runtime.)

## Revised outcome

Formula rendering alone does not meet the clarified requirement. The coherent
capability has three complementary parts:

1. Keep KaTeX plus `mhchem` for compact formulae, equations, charges, reaction
   arrows, and physical units embedded in prose.
2. Add a visual scientific-content block, authored with Ketcher and displayed
   as a static accessible image. Ketcher covers small molecules, reactions,
   peptides, amino acids, nucleic acids, RNA/DNA sequences, FASTA, and HELM.
3. Give Chat a first-party scientific-visual tool and a dedicated visual card.
   The tool validates an authoritative chemical or biological representation,
   produces a private static preview, and returns structured provenance. The
   chatbot works with the authoritative source, not pixels or model-authored
   SVG.

Ketcher is the recommended foundation. It provides one visual editor for both
chemistry and the biomolecular part of biology, supports React 19, can run with
client-side Indigo WebAssembly, and is Apache-2.0 licensed. Its native KET JSON
format works for both molecule and macromolecule modes.

Do not load Ketcher or a cheminformatics WebAssembly engine in every participant
Markdown view. Load the editor only in Manage, generate a static PNG at
authoring time, and let the shared renderer display that immutable preview with
required alternative text. This preserves participant-app performance, avoids
an active SVG surface in the first release, and keeps scientific data inside the
browser during authoring.

`chemfig` remains useful only as an optional legacy-import path. It is a TikZ
drawing language, not a machine-readable molecule or biology format. Supporting
raw `chemfig` would require a separately sandboxed, networkless TeX renderer and
would still not cover biological sequences or pathways.

## Formulae and equations

Support the `mhchem` subset from the Overleaf guide through KaTeX's bundled
extension. This fits the current Markdown storage and rendering architecture and
would add chemical formulae, equations, charges, arrows, and physical units
without a schema or editor-model change.

Do not describe this as full Overleaf chemistry support. Overleaf covers two
different LaTeX packages:

- `mhchem` provides formulae and equations through `\ce{...}`. KaTeX provides a
  compatible extension with `\ce` and `\pu`.
- `chemfig` draws structural formulae through TikZ. KaTeX does not implement it,
  so supporting `\chemfig{...}` would require a separate, sandboxed rendering
  system or a chemistry-specific structure editor.

The `mhchem` change remains a small part of the complete capability. Preserve
the existing raw Markdown authoring flow, document the supported syntax, and
explicitly distinguish it from visual structure blocks.

## What already exists

The shared Markdown renderer in
`packages/markdown/src/Markdown.tsx` already uses this pipeline:

`remark-parse -> remark-math -> remark-rehype -> rehype-sanitize -> rehype-katex`

Important current contracts:

- `singleDollarTextMath` defaults to `false`, so inline formulae use matching
  double-dollar delimiters. This avoids interpreting ordinary currency amounts
  as mathematics.
- Sanitization runs before KaTeX. This matches the upstream security guidance
  while preserving KaTeX's generated HTML and MathML.
- The Manage editor stores Markdown and preserves LaTeX backslashes through
  `packages/shared-components/src/utils/slateMdConversion.ts`.
- The editor already inserts inline and display `$$` formula delimiters in
  `apps/frontend-manage/src/components/common/ContentInput.tsx`.
- Manage preview, participant display, and control display use the shared
  renderer. No GraphQL, database, or stored-content migration is needed.

The current editor shows source syntax while editing; rendering happens in the
existing preview and display components. A chemistry-specific toolbar shortcut
would be useful later, but is not required for the capability. It should be
designed against the target editor after the open Tiptap migration stack is
settled, rather than adding substantial Slate-only behavior now.

Chat has a separate Markdown path in
`apps/chat/src/components/markdown-text.tsx`. Load the same `mhchem` extension
there so assistant messages can render compact chemistry. Visual structures
should not be encoded as Markdown images or raw fenced JSON in model output;
they need the typed chat contract described below.

The current Slate conversion already parses and serializes fenced code blocks,
including their language identifier and body. The editor does not expose a
typed `code_block` node or custom visual treatment yet, but that is a contained
editor change. The same Markdown contract can later receive a Tiptap NodeView.

## Visual structures and biology

### Recommended authoring and display path

1. A new toolbar action opens Ketcher in a lazily loaded Manage modal.
2. The lecturer draws a molecule, reaction, peptide, or nucleotide sequence, or
   imports SMILES, MOL/RXN, FASTA, HELM, or another supported format.
3. On insertion, Ketcher exports authoritative KET source plus a display image.
   The browser uploads only to a staging Blob. The server validates it and
   publishes the bytes under a create-only final URL that never receives browser
   write credentials.
4. The editor inserts a generated fenced block into the Markdown field. Authors
   see a preview card with Edit, Replace, and Remove actions instead of JSON.
5. The shared renderer validates the block and emits only the static image,
   caption, and alternative text. Unknown versions or kinds degrade to a
   bounded unsupported-content message.

Illustrative generated contract:

````markdown
```klicker-visual
{
  "version": 1,
  "kind": "molecule",
  "format": "ket",
  "source": { "...": "Ketcher data" },
  "previewUrl": "https://trusted-media-host/example.png",
  "alt": "Structural formula of adenosine triphosphate",
  "caption": "ATP"
}
```
````

This block is generated and edited through the visual UI; lecturers should not
need to manipulate its JSON. The first version should impose explicit source,
image-dimension, and text-length limits and accept preview URLs only from the
configured media host. Raw user-provided SVG must never be inserted directly.

### Biology boundary

Ketcher directly covers the biomolecular portion of the requirement:

- amino acids, peptides, nucleotides, RNA, and DNA;
- molecule and reaction diagrams;
- sequence, snake, and flexible macromolecule layouts;
- KET, FASTA, HELM, IDT, AxoLabs, MOL/RXN, SMILES, and related import/export
  formats.

It does not make arbitrary biology diagrams a solved problem. Long annotated
sequences, plasmids, protein features, metabolic pathways, cells, anatomy, and
experimental setups need separate renderers or ordinary images. The fenced
block should therefore use a renderer registry keyed by `kind`, allowing later
`sequence`, `pathway`, or `protein-structure` blocks without changing the
Markdown storage model.

Use the same outer visual envelope, but keep each scientific source schema and
renderer explicit:

| Biology visual | Authoritative source | Candidate display | Release |
| --- | --- | --- | --- |
| Molecules, reactions, peptides, and short nucleic acids | KET, with SMILES, MOL/RXN, FASTA, or HELM for interchange | Ketcher/Indigo-generated PNG | Initial |
| Annotated protein or gene sequences | Sequence plus bounded feature annotations | Nightingale components or a generated static preview | Later typed kind |
| 3D protein and nucleic-acid structures | PDBx/mmCIF plus a pinned view state | Mol* interactive view with a static fallback | Later typed kind |
| Metabolic and signalling pathways | SBGN-ML plus renderer options | Dedicated SBGN renderer and static fallback | Later typed kind |
| Cells, anatomy, and experimental setups | Lecturer-owned media plus annotations and source references | Existing image display | Image-first; no inferred scientific structure |

This makes “works for biology” extensible without pretending that a molecule
editor can represent every biological diagram.

### Product primitive impact

| Product primitive | Disposition | Contract delta | Consumers |
| --- | --- | --- | --- |
| Element content | Extend | Markdown gains a versioned embedded scientific-visual value | Manage editor and all shared Markdown displays |
| ElementInstance snapshot | Reuse | Published snapshots retain the exact block source and immutable preview URL | LiveQuiz, PracticeQuiz, MicroLearning, and GroupActivity |
| MediaFile | Compose | Stores the generated display artifact; it does not own scientific meaning | Manage media upload and public image delivery |
| ScientificVisual | Do not create yet | Keep it an embedded value until reuse, sharing, or an independent lifecycle is required | None in the first release |

If lecturers later need a reusable visual library or cross-element editing, a
versioned, User-owned `ScientificVisual` becomes a real product primitive. Each
edit must create a new immutable revision so published ElementInstances never
change retroactively.

## Chatbot display and interaction

### Current chat seams

The current Chat stack is unusually close to supporting this safely:

- `apps/chat` uses AI SDK `7.0.52`, assistant-ui `0.15.1`, a Zustand-backed
  `useExternalStoreRuntime`, and a hand-written AI SDK UI-stream parser.
- `ChatMessage.content` is JSON and already persists ordered text, reasoning,
  tool-call, and named data parts. Completed tool results therefore survive a
  reload and can drive a dedicated visual renderer.
- `AssistantMessageParts` already gives tool parts a custom UI seam before the
  generic `ToolFallback`; scientific visuals can render as standalone cards
  instead of expandable raw JSON.
- Chat image attachments are stored separately, return compact previews in
  history, and hydrate full data through an endpoint scoped by chatbot,
  participant, thread, and message. This is a better home for chat preview
  images than the public lecturer `MediaFile` path.
- The route already sends a newly attached image to a vision-capable model and
  stores a generated description for later turns.

One gap is decisive: `useChatResponse.ts` serializes only text parts when it
sends conversation history to the next model call. Tool results and data parts
remain visible after reload but are omitted from later model context. A visual
card could therefore display correctly while the chatbot no longer knows its
SMILES, KET, FASTA, or HELM source. The implementation must close this gap; an
image description is not an exact molecular or sequence representation.

Do not close this gap by accepting the full tool payload back from the browser.
The route should rebuild model history from authorization-checked persisted
messages and project only the validated scientific source into model context.
If the custom conversion later adopts AI SDK `convertToModelMessages`, use its
`convertDataPart` hook for this specific typed value instead of forwarding every
client data part.

### Recommended chat contract

Use a first-party, route-owned `scientific_visual` tool with a versioned result.
The model may request a visual, but it must not author the final preview,
storage URL, provenance, or citations.

Illustrative semantic payload:

```json
{
  "schemaVersion": 1,
  "kind": "molecule",
  "source": {
    "format": "ket",
    "value": "validated Ketcher-native data",
    "sha256": "server-computed digest"
  },
  "modelContext": {
    "format": "smiles",
    "value": "CC(=O)OC1=CC=CC=C1C(=O)O"
  },
  "preview": {
    "attachmentId": "participant-scoped chat attachment",
    "mediaType": "image/png",
    "width": 1200,
    "height": 800
  },
  "accessibility": {
    "alt": "Skeletal structure of acetylsalicylic acid",
    "caption": "Acetylsalicylic acid"
  },
  "provenance": {
    "origin": "assistant-generated",
    "renderer": "indigo",
    "rendererVersion": "server-recorded version",
    "derivedFromDigest": null,
    "sourceIds": []
  },
  "warnings": []
}
```

The shared semantic fields are `schemaVersion`, `kind`, Ketcher-native KET as
the authoritative edit/render source, a compact validated representation for
model context, accessibility text, provenance, and warnings. SMILES, MOL/RXN,
FASTA, and HELM remain import and model-interchange formats rather than being
assumed to preserve every Ketcher feature. The preview reference remains
container-specific: course content refers to a lecturer-owned `MediaFile`,
while Chat refers to a participant-scoped `ChatAttachment`. A participant chat
must never expose its private attachment by copying that URL into public course
content.

The first-party Chat route should own the tool execution. It should:

1. Accept only an allow-listed pairing of kind and source format, with explicit
   size and complexity limits. Start with molecule/reaction plus SMILES or
   MOL/RXN, and peptide/DNA/RNA plus FASTA or HELM. Accept KET after the parser
   and storage bounds are proven. Normalize successful input to authoritative
   KET plus the most suitable compact model-context export.
2. Parse and normalize the source with a deterministic chemistry engine,
   then generate a raster preview. Syntax validation proves that a structure is
   machine-readable; it does not prove that the model's chemistry or biology is
   scientifically correct.
3. Store the preview as an assistant-message attachment under the existing
   participant/thread authorization boundary. Do not return arbitrary URLs,
   HTML, or raw SVG from the model or an untrusted MCP server.
4. Add server-owned provenance and validated source identifiers. The generating
   model may suggest alternative text, but the server enforces presence and
   bounds before persistence.
5. Return the structured result to the model so it can explain the visual in
   the same turn. Persist only the validated projection, never an unbounded raw
   provider or renderer response.

The Chat prototype must also settle renderer placement. The two viable choices
are a pinned, networkless internal Indigo service exposing bounded validation,
conversion, and rendering operations, or a server-compatible local engine in
the Chat deployment. Browser Ketcher plus Indigo WebAssembly remains the Manage
authoring path and should not be assumed to work inside the server route. In
either case, block renderer egress, cap execution and output size, and record
the exact renderer version in the result.

### Display and revision flow

1. The participant asks for a structure or supplies SMILES, MOL, FASTA, HELM,
   or another supported structured representation.
2. The model calls `scientific_visual`; the card shows a bounded loading state.
3. The tool validates, normalizes, renders, stores, and returns the result.
4. A dedicated assistant-ui card shows the preview, caption, generated-status
   badge, warnings, zoom/download actions, and an accessible text summary. The
   raw tool payload stays out of the generic fallback panel.
5. On a later turn, the server recovers the exact validated visual result from
   the participant-owned message history and converts its authoritative source
   into model context. Do not trust a client-supplied preview URL or replay only
   the image description.
6. A natural-language revision asks the tool to create a new immutable result
   with `derivedFromDigest`; it does not mutate an old assistant message.
7. A later Ketcher action can open the authoritative source in a lazy modal.
   Saving creates a new user message and branch containing a validated visual
   value, after which the chatbot can explain or revise that new version.

The existing branch model is the initial version history. Do not adopt
assistant-ui's currently unstable interactables API as the persistence model in
the first release. It is a promising later prototype for shared user/model
editing, but the current external-store runtime, custom stream parser, and
Prisma message format would all need explicit compatibility proof.

### What the chatbot can and cannot do

The chatbot can work exactly with a visual when it has authoritative source. It
can explain, compare, revise, convert supported formats, or create a new
rendering without sending preview pixels back to the model. This path also works
with a text-only model lane once the source already exists.

An uploaded screenshot is different. The current app can show it to a
vision-capable model and preserve a prose description, but image-to-structure
recognition must be a separate confidence-gated import. A caption cannot safely
recover stereochemistry, bond order, atom labels, sequence positions, or
diagram topology. A low-confidence import must remain an image with an explicit
warning and require user confirmation before becoming editable structured data.

Ketcher covers biomolecular structures and short sequence layouts. General
biology visuals such as pathways, annotated proteins, plasmids, cells, anatomy,
and experimental setups still require their own typed renderers. Retrieved
course images are another independent capability: attachment display does not
prove image acquisition, indexed retrieval, access control, or source-specific
citation support.

### Provenance and citations

Keep three claims separate in the UI:

- **What it is:** authoritative source and deterministic renderer output.
- **Who produced it:** course-authored, participant-edited, or
  assistant-generated, plus renderer and revision provenance.
- **What supports it:** zero or more validated course-source references from the
  existing source registry.

A visual generated from cited course material remains labelled generated. A
citation supports only the claim and locator it actually resolves; it does not
automatically certify every bond, label, or sequence in the generated visual.
`sourceIds` must resolve through the same normalized, authorization-checked
source path as answer citations. Never accept raw URLs, snippets, or numbered
markers from the generating model as provenance.

### Product primitive impact for Chat

| Product primitive | Disposition | Contract delta | Consumers |
| --- | --- | --- | --- |
| ChatMessage | Extend | Content may contain a validated scientific-visual tool result or user data part | Chat stream, persistence, reload, branching, and model-context reconstruction |
| ChatAttachment | Reuse | Stores the private static preview for the owning message | Chat history preview, full-image hydration, zoom, and download |
| ChatThread branch | Reuse | Each edit or regeneration creates a new immutable visual result on a branch | Participant revision history and retry |
| MediaFile | Keep separate | Continues to store lecturer-owned course previews only | Manage and participant content display |
| ScientificVisual | Do not create yet | Shared semantics stay a versioned value object; promotion copies data and artifact into lecturer ownership | Reconsider only for a reusable library or cross-context identity |

This avoids a premature cross-owner entity. A future “Add to course content”
action is a lecturer-authorized promotion that copies the authoritative value,
rerenders or copies the preview into a new lecturer-owned `MediaFile`, and
creates a new course block. It must not turn a participant chat attachment into
a shared public resource by reference.

## Author syntax after the change

Authors would not enter `\usepackage{mhchem}`. KlickerUZH would load the
extension centrally.

Inline formula:

```markdown
Water is $$\ce{H2O}$$.
```

Display equation:

```markdown
$$
\ce{2 H2 + O2 -> 2 H2O}
$$
```

Charges and reaction conditions:

```markdown
$$
\ce{Hg^2+ ->[I-] HgI2 ->[I-] [Hg^{II}I4]^2-}
$$
```

Physical units:

```markdown
The molar heat capacity is $$\pu{75.3 J // mol K}$$.
```

The delimiters are KlickerUZH's existing Markdown convention; the content
inside `\ce` and `\pu` follows the KaTeX `mhchem` dialect. Most Overleaf
`mhchem` examples transfer directly, but exact parity with LaTeX `mhchem`
version 4 is not guaranteed.

## Proposed implementation footprint

1. Add the repository's resolved KaTeX version as a direct dependency of
   `@klicker-uzh/markdown`. The lockfile currently resolves KaTeX `0.16.22`.
2. Load `katex/contrib/mhchem` once in the shared Markdown renderer before
   `rehype-katex` renders content. Keep `trust: false` and the existing
   sanitize-before-render order.
3. Align the KaTeX stylesheet with the exact JavaScript version. Manage, PWA,
   and Control currently load CDN CSS `0.16.4`, while the renderer resolves
   KaTeX `0.16.22`. Update all display surfaces together, including Chat and the
   separate Docusaurus `rehypeKatex` pipeline, and retain integrity metadata if
   the CDN path remains.
4. Add the versioned `klicker-visual` fenced-block parser and static-image
   renderer without adding Ketcher to the shared Markdown bundle.
5. Add a dynamically imported Ketcher modal and a custom visual block node to
   the Manage editor. Use its standalone Indigo WebAssembly provider first so
   authoring introduces no external service or new data boundary.
6. Add a durable scientific `MediaFile` reservation/finalization state machine.
   Generate to staging, validate source, output type, dimensions, and ownership,
   publish a create-only final object, persist byte hash/ETag, and bind
   finalization to element persistence. Hide non-finalized rows from the normal
   media library and clean abandoned states idempotently.
7. Add focused renderer and editor round-trip tests, then document the syntax,
   accessibility contract, supported biological scope, and unsupported
   `chemfig`/general-diagram cases in the engineering wiki and author help.
8. Load `mhchem` in Chat's separate Markdown renderer and align its KaTeX CSS
   and JavaScript version with the shared display surfaces.
9. Add the first-party `scientific_visual` tool to the Chat route's effective
   toolset, including prompt-cache identity. Validate its input/output with a
   shared schema, normalize it with the renderer, and persist only the safe
   projection.
10. Add a standalone scientific-visual card for completed tool parts and a
    bounded loading/error card. Store the preview through the participant-scoped
    attachment path; never expose the full tool payload through the generic
    fallback.
11. After PR #5676's authoritative-history contract is merged, extend that exact
    seam so the server replays validated source from participant-owned persisted
    messages. Do not add a competing branch-reconstruction path or rely on the
    current text-only client serializer or image descriptions.
12. Add Ketcher-in-Chat editing only after the read-only card and cross-turn
    revision flow are proven. Saving an edit creates a new user message and
    branch; it never rewrites the source assistant message.

The course embedded value does not require a standalone `ScientificVisual`
table or content migration, but the existing media upload mutation is not a
safe immutable-publication contract. One scoped `MediaFile` migration and
server API must track staging, finalization, byte identity, cleanup, transfer,
and erasure. Chat likewise stores the semantic value in `ChatMessage.content`,
but needs one scoped `ChatAttachment` migration for server-owned tool-call
correlation and atomic preview persistence. A later reusable visual library
would require separate schema, permissions, and versioning.

## Verification and acceptance

- Render representative `\ce` cases: simple formula, stoichiometric equation,
  reversible/annotated arrow, isotope or charge, and nested brackets.
- Render one `\pu` case.
- Assert successful output contains KaTeX markup and MathML and does not contain
  `.katex-error`.
- Round-trip each example through the current Markdown-to-editor and
  editor-to-Markdown conversion without losing backslashes, braces, spaces, or
  delimiters.
- Verify malformed `mhchem`, `\chemfig`, and `\ch` remain visible as bounded
  errors instead of breaking the surrounding Markdown display.
- In the browser, author, preview, save, reopen, and display synthetic chemistry
  content in Manage and the participant app. Capture desktop and mobile states.
- Confirm ordinary prices containing a single `$` remain prose.
- Confirm the final CSS and JavaScript KaTeX versions match on every display
  surface.
- Create and reopen one small molecule, one reaction, one peptide, and one DNA
  or RNA sequence through Ketcher.
- Assert the block survives editor to Markdown to shared preview to reopen with
  identical KET source and immutable preview URL.
- Confirm participant surfaces render the visual without downloading Ketcher
  or Indigo WebAssembly.
- Require useful alternative text and verify keyboard access, focus handling,
  zoom, high contrast, responsive layout, and screen-reader announcement.
- Reject oversized or malformed source, untrusted preview URLs, raw SVG, and
  unsupported block versions without breaking surrounding Markdown.
- Measure the Ketcher editor chunk and Indigo WebAssembly load in a focused
  prototype before fixing the package version or modal-loading strategy.
- Stream a scientific tool call through loading, success, invalid-source,
  renderer-failure, cancellation, and connection-loss states. Reload each
  terminal state and require the same bounded card without raw payload leakage.
- Continue the conversation after a reload and verify that the model receives
  the exact authoritative source and digest, not only assistant prose or an
  image description.
- Revise one visual twice and verify that each result is immutable, carries the
  correct `derivedFromDigest`, and follows the existing branch/reload behavior.
- Prove that a participant cannot fetch another participant's preview by
  changing chatbot, thread, message, or attachment identifiers.
- Verify that message finalization, cancellation, thread deletion, and failed
  rendering neither orphan previews nor delete previews owned by another
  branch.
- Verify citations independently: generated visuals keep their generated badge;
  only authorized source IDs render; changed, unavailable, or unsupported
  sources degrade honestly; and no citation implies scientific validation.
- Confirm a text-only model can reason over an existing authoritative visual
  while image-upload analysis stays disabled for models without image support.

## Options considered

| Option | Result | Reason |
| --- | --- | --- |
| Ketcher authoring plus static preview | Recommended | Covers chemistry, reactions, peptides, and nucleic acids while keeping the student display lightweight |
| RDKit.js rendering in every display | Prototype only | Strong small-molecule SVG renderer, but adds WebAssembly to participant surfaces and does not provide authoring or macromolecule coverage |
| KaTeX plus bundled `mhchem` | Include alongside visuals | Best fit for formulae and equations embedded in prose; it does not draw molecular structures |
| Replace KaTeX with MathJax | Do not pursue | Larger migration without solving visual molecule authoring |
| Client-side KaTeX auto-render | Reject | Creates a second delimiter/parser path and risks preview/display divergence |
| Full server-side `chemfig` | Legacy-only option | Requires a hardened TeX service and still lacks machine-readable chemistry and biology semantics |
| Raw model-authored SVG/Markdown image | Reject | Gives untrusted model output an active-content and arbitrary-URL surface and loses authoritative scientific meaning |
| Scientific tool result plus dedicated Chat card | Recommended | Fits the existing persisted tool-part model while separating authoritative source, preview, provenance, and citations |
| assistant-ui interactable visual | Later prototype | Promising shared user/model editing and history, but the API is unstable and the current custom runtime must prove persistence and stream compatibility |

## Sources

- [Overleaf: Chemistry formulae](https://www.overleaf.com/learn/latex/Chemistry_formulae)
- [KaTeX supported libraries and extensions](https://katex.org/docs/libs)
- [KaTeX function support table](https://katex.org/docs/support_table)
- [KaTeX options](https://katex.org/docs/options)
- [KaTeX security guidance](https://katex.org/docs/security)
- [KaTeX common issues, including CSS/JavaScript version matching](https://katex.org/docs/issues)
- [remark-math and rehype-katex](https://github.com/remarkjs/remark-math)
- [CTAN: mhchem](https://ctan.org/pkg/mhchem)
- [CTAN: chemfig](https://ctan.org/pkg/chemfig)
- [Ketcher repository and API documentation](https://github.com/epam/ketcher)
- [Ketcher user documentation](https://lifescience.opensource.epam.com/ketcher/)
- [Ketcher React package](https://www.npmjs.com/package/ketcher-react)
- [Indigo Service validation, conversion, and rendering API](https://lifescience.opensource.epam.com/indigo/service/index.html)
- [Indigo rendering API](https://lifescience.opensource.epam.com/indigo/api/index.html)
- [RDKit.js](https://github.com/rdkit/rdkit-js)
- [CommonMark fenced-code information strings](https://spec.commonmark.org/0.31.2/#info-string)
- [Nightingale biological-data visualisation components](https://github.com/ebi-webcomponents/nightingale)
- [RCSB PDB: Mol* 3D structure visualization](https://www.rcsb.org/docs/exploring-a-3d-structure/structure-3d-visualization)
- [Systems Biology Graphical Notation and SBGN-ML](https://sbgn.github.io/)
- [assistant-ui: image generation and image message parts](https://www.assistant-ui.com/docs/guides/image-generation)
- [assistant-ui: custom tool UIs](https://www.assistant-ui.com/docs/tools/tool-ui)
- [assistant-ui: interactable tool UIs](https://www.assistant-ui.com/docs/tools/interactables)
- [assistant-ui: external store runtime](https://www.assistant-ui.com/docs/runtimes/custom/external-store)
- [AI SDK: streaming custom data parts](https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data)
- [AI SDK: chatbot message persistence and validation](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)
- [AI SDK: multimodal message prompts](https://ai-sdk.dev/docs/foundations/prompts)
- [AI SDK: converting UI data parts into model context](https://ai-sdk.dev/docs/reference/ai-sdk-ui/convert-to-model-messages)

## Decision needed before implementation

Proceed on the assumption that “biology” initially means biomolecular
structures and short peptide/RNA/DNA sequence layouts, which Ketcher supports.
For Chat, the recommended initial scope is display, explanation, and immutable
natural-language revisions of authoritative visuals. Direct participant editing
in Ketcher is the next slice, not part of the first proof. If the requirement
also includes pathways, plasmids, cells, anatomy, general scientific
illustrations, or image-to-structure recognition, settle those as separate
visual kinds before the implementation plan is written.

The first implementation should be preceded by three focused prototypes. The
Ketcher prototype must prove React/Next integration, current Slate fenced-block
round-tripping, KET plus preview export, package/runtime size, responsive
behavior, and basic keyboard accessibility.

The media prototype must prove staging-only write credentials, create-only final
publication, hash/ETag identity, race-safe retry/cleanup, server-side flag
enforcement, generic-media filtering, ownership transfer, and Blob deletion
before account-row cascade.

After PR #5676 merges, run the Chat prototype through the real request/history
seam and hand-written stream parser. It must prove a tool-generated visual
through stream, persistence, private by-ID preview hydration, reload, branch
revision, later-turn authoritative-source replay, aggregate budgets, and the
remaining request deadline. If synchronous rendering misses the fixed route
budget, stop and revise the plan for an explicit asynchronous message contract;
do not hide a background job behind the synchronous result.
