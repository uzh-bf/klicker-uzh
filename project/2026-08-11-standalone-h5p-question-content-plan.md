# Standalone H5P in question content

Status: shared product understanding confirmed; renewed planning review
complete; implementation has not started.

Date: 2026-08-11

Last simplified: 2026-08-23

Target branch: `v3`

## Goal

Let a lecturer upload an `.h5p` file, embed it in the main content of a
question, and render it with `h5p-standalone`. The asset should feel like
existing media: it can be selected, replaced, removed, or deleted without a
separate revision-management workflow.

The implementation remains secure enough for executable H5P packages, but those
controls stay behind the media-like product experience.

## Decisions

1. An **H5P Asset** is a replaceable media-like asset owned by a lecturer.
2. Replacing its file updates every H5P Embed that points to the asset, including
   embeds inside existing activities and `ElementInstance` snapshots.
3. Removing an H5P Embed removes only that placement. Deleting an H5P Asset
   leaves existing opaque asset references unchanged; those references render
   the accessible unavailable placeholder and never launch a Viewer. Reuse
   current media permissions and feedback only where they preserve this
   behavior. V1 adds no H5P-specific archive, unpublish, retention, transfer,
   sharing, or co-ownership workflow.
4. Lecturers see no Revision model or history. Safe temporary artifacts used
   while validating a replacement are implementation details.
5. Playback is display-only. H5P receives no participant identity and cannot
   submit a response, score an answer, emit xAPI, save learning state, award
   points, or change correctness.
6. V1 permits at most one H5P Embed, only in main `Element.content`. Answer
   choices, explanations, feedback, grading rubrics, activity descriptions, and
   other rich-text fields remain excluded.
7. One typed rendering contract covers every main-content renderer, including
   standard and assessment surfaces.
8. `h5p-standalone` runs the package in an isolated viewer, not in the
   KlickerUZH application document.
9. V1 admits two top-level content types through exact pinned recursive
   dependency profiles:
   - Course Presentation for user-controlled slide changes and locally packaged
     motion media with controls; and
   - Agamotto for user-controlled image sequences that show a process or change
     over time.
     PowerPoint-style object animation, automatic frame animation, parallax
     presentations, remote media, and every other top-level H5P content type
     remain excluded.

## Product contract

### Upload

The H5P picker uses the same mental model as the media library. A lecturer can:

- upload an `.h5p` file;
- wait for validation;
- select the asset for a question;
- replace its file; and
- remove the Embed or delete its asset with media-like permissions and feedback.

The UI does not expose package generations, artifact digests, catalog releases,
Viewer Sessions, or admission terminology.

### Replace

A replacement is prepared without interrupting the currently working asset. If
validation fails, the current file remains active and every existing Embed keeps
working. If validation succeeds, the asset switches atomically to the new file
and every Embed loads it on the next render.

There is no option to keep an old version or pin an individual Embed to it.

### Embed

Question Markdown stores one opaque asset reference:

```md
::h5p{asset="<UUID>"}
```

The directive contains no URL, HTML, script, storage path, or package metadata.
An `ElementInstance` snapshot keeps the same asset reference, so replacing the
asset intentionally changes what that snapshot renders.

Removing the editor node removes the directive. A missing or deleted asset shows
an accessible unavailable placeholder and never creates a viewer.

### Playback

The question renderer loads an isolated H5P Viewer in an iframe. The Viewer uses
`h5p-standalone` to render the currently active file for the referenced asset.
It receives no KlickerUZH session, participant identity, answer state, scoring
context, or submission capability.

The parent and Viewer exchange only bounded resize, ready, and safe error
messages.

## V1 scope

V1 includes:

- lecturer upload, selection, replacement, removal, and deletion;
- Course Presentation and Agamotto through exact pinned recursive dependency
  profiles;
- one Embed in main question content;
- participant rendering, lecturer preview, and assessment rendering;
- responsive sizing, keyboard access, loading, error, and unavailable states;
- German and English UI copy; and
- one global runtime kill switch.

V1 excludes:

- H5P authoring or editing inside KlickerUZH;
- Revision history, rollback, archive, sharing, transfer, or co-ownership;
- H5P scoring, xAPI, saved state, identity, or submissions;
- arbitrary iframe URLs;
- external network access from package content;
- PowerPoint-style object animation, automatic frame animation, and parallax
  presentations;
- multiple Embeds or H5P in secondary rich-text fields;
- offline playback; and
- cross-environment H5P export or import.

## Existing KlickerUZH seams

The bullets below are a candidate seam inventory from earlier investigation,
not claims about current `v3`. Before implementation, fetch `origin/v3` and
verify every path, caller, snapshot behavior, media permission and deletion
rule, landed Tiptap version, assessment seam, and main-content renderer. Record
or correct the inventory before code changes.

- `Element.content` stores Markdown.
- `ElementInstance.elementData` snapshots that Markdown. The H5P Asset ID inside
  the snapshot remains stable while file replacement changes the asset it
  resolves to.
- `packages/graphql/src/services/elements.ts` is the save boundary for enforcing
  one valid H5P directive in main content.
- `packages/markdown/src/Markdown.tsx` is the typed rendering extension point;
  raw HTML remains disabled.
- Main content is rendered through `QuestionContent.tsx`,
  `CaseStudyQuestion.tsx`, `Flashcard.tsx`, `ContentElement.tsx`, and
  manage/result paths. All use one H5P Embed contract.
- The existing media upload and picker establish the expected lecturer UX and
  deletion behavior. Implementation must verify those current `origin/v3`
  semantics before copying them.
- The current `MediaFile` storage path is image-oriented and publicly readable.
  Reuse its product behavior, not code that would execute an unchecked package
  on a KlickerUZH origin.
- H5P editor work starts only after the Tiptap migration has landed on current
  `v3`.

## Minimal technical design

### H5P Asset

Use one H5P Asset record, not separate content and revision models. It holds:

- owner and display metadata;
- upload or validation status;
- the active admitted artifact identifier and digest;
- the supported main library; and
- safe validation or error metadata.

Embeds reference only the H5P Asset ID.

### Upload and replacement safety

Initial upload and replacement use the same bounded pipeline:

1. Accept an authenticated lecturer upload into temporary private storage.
2. Capture an immutable input for validation so the file cannot change while it
   is scanned.
3. Reject malformed ZIPs, traversal, symlinks, duplicate entries, decompression
   bombs, unsupported files, external URLs, and configured size or time limits.
4. Scan the package and validate its H5P metadata.
5. Accept only Course Presentation or Agamotto with an approved exact recursive
   dependency profile. Validate package content and media references as well as
   dependency names and versions. Uploaded libraries cannot install or shadow
   executable libraries used by the Viewer.
6. Publish normalized content assets only after every check succeeds.
7. For replacement, atomically switch the H5P Asset to the admitted artifact.
   Until that switch, the previous file stays active.

Failed and superseded temporary artifacts use the existing media cleanup policy.
V1 introduces no lecturer-visible history or H5P-specific retention controls.

### Isolated H5P Viewer

The Viewer runs on a separately controlled origin outside the KlickerUZH cookie
scope. It has:

- no KlickerUZH cookies or authenticated application APIs;
- a response-header CSP that blocks external connections and permits only its
  pinned runtime and admitted assets;
- iframe sandbox permissions limited to what `h5p-standalone` needs;
- no forms, popups, downloads, top navigation, or fullscreen in V1; and
- exact-origin, exact-source validation for resize and error messages.

Admitted H5P assets follow the same visibility expectations as existing media.
V1 does not add a private per-viewer session or Revision-scoped capability
model.

### Editor and rendering

Add one atomic Tiptap H5P node for main question content. Its picker follows the
existing media interaction and adds Replace File for the selected H5P Asset.

The shared renderer resolves the asset, renders the isolated Viewer, and provides
loading, unavailable, and error fallbacks. All main-content surfaces receive the
same typed input rather than parsing H5P independently.

## Execution contract

Authority: After explicit plan approval, future execution may perform reversible
task-worktree edits, checks, browser verification, required reviews, Progress
updates, and local commits. Push, PR creation or update, merge, deployment,
feature-flag mutation, and live actions remain withheld.

Terminal: Locally committed implementation, fresh verification, integrated
final review, renderer evidence, and rollback proof; stop before external
delivery.

Pause: Stop if fresh `origin/v3` evidence materially changes the design,
uploaded executable libraries become necessary, or isolation, replacement,
deletion, animation accessibility, or rollback cannot be proven.

## Delegation map

| Slice | Owner | Paths | Dependency | Acceptance |
| --- | --- | --- | --- | --- |
| 1. Re-baseline and prove seams | Main session | Candidate seams named in the plan; record corrected paths in `Progress` | Fresh `origin/v3` | Current commit and seam matrix recorded; isolated packages, pinned-dependency profiles, animation accessibility, replacement, and Tiptap proofs pass |
| 2. Asset upload and Viewer | Main session | Verified Prisma, GraphQL, media-service, Viewer, and deployment seams from Slice 1 | Slice 1 accepted | Admission rejects unsupported packages; failed replacement preserves the active file; successful replacement updates questions and snapshots; isolation checks pass |
| 3. Authoring and rendering | Native executor | Verified Markdown, editor, renderer, i18n, and browser-test seams | Slices 1–2 accepted | One-Embed enforcement, deterministic editor round trip, complete renderer matrix, accessibility, and browser evidence pass; the main session inspects and integrates the result |

## Implementation plan

### 1. Re-baseline and prove the uncertain seams

Before production implementation:

- record the verified `origin/v3` commit and a renderer matrix covering lecturer
  preview, participant playback, assessment, evaluation/results, and every
  element type that renders main content;
- render representative Course Presentation and Agamotto packages through
  `h5p-standalone` on the isolated Viewer origin;
- include locally packaged controlled motion media in the Course Presentation
  proof and a process or change-over-time sequence in the Agamotto proof;
- prove both exact allowed recursive dependency profiles and confirm
  package-supplied executable libraries are not used;
- prove remote media and links are rejected and the Viewer cannot connect
  externally;
- prove that a failed replacement leaves the current file active and a
  successful replacement updates an existing Embed; and
- prove Tiptap parse, serialize, reopen, paste, replace, remove, and undo behavior
  on the landed editor version.

Stop if either representative package cannot run without trusting arbitrary
uploaded libraries or external network access.

### 2. Add H5P Asset upload and Viewer playback

- add the H5P Asset persistence and lecturer-scoped GraphQL operations;
- add bounded upload, validation, replacement, and cleanup;
- build the isolated Viewer with the pinned `h5p-standalone` runtime;
- reuse verified current media permissions and feedback while preserving the
  H5P deletion outcome above;
- add the global runtime kill switch; and
- verify standard and assessment environments before enabling rendering.

### 3. Add question-content authoring and rendering

- add the strict Markdown directive and backend validation;
- add the atomic Tiptap node and media-like picker;
- enforce at most one Embed in main `Element.content`;
- wire every main-content renderer through the shared H5P contract;
- add accessible loading, unavailable, and error states; and
- activate authoring only after browser verification succeeds.

## Verification portfolio

| Behavior | Evidence |
| --- | --- |
| Upload | Supported package becomes selectable only after validation |
| Failed replacement | Existing Embed continues loading the previous file |
| Successful replacement | Existing questions and snapshots load the new file |
| Remove and delete | Removing the Embed removes only that placement; deleting the asset preserves references, shows the unavailable placeholder, and uses media-like permissions and feedback where compatible |
| Directive round trip | Save, reopen, copy, paste, replace, remove, and undo remain deterministic |
| Renderer coverage | Every standard, assessment, preview, and result main-content surface uses the shared contract |
| Isolation | Package code cannot access KlickerUZH cookies, DOM, storage, or APIs |
| Display-only boundary | No identity, response, scoring, xAPI, or saved state crosses into H5P |
| Basic animations | Course Presentation plays local motion media with user controls; Agamotto exposes a keyboard-operable user-controlled image sequence; automatic motion, parallax, and remote media are rejected |
| Accessibility | Keyboard access, iframe title, responsive sizing, and fallback text pass browser checks |
| Rollback | Disabling the global flag removes playback without deleting content references |

Browser verification is mandatory on representative mobile and desktop
viewports in German and English. Assessment playback is part of the same
activation gate, not a later lifecycle.

## Security boundary

An `.h5p` file is executable content packaged as a ZIP. The product remains
media-like, but two implementation controls are non-negotiable:

1. the server validates and admits the package before it becomes loadable; and
2. `h5p-standalone` executes it only on the isolated Viewer origin.

These controls do not create a lecturer-facing Revision or governance product.

## Rollout and rollback

- Keep the global H5P flag off through upload, Viewer, editor, and renderer work.
- Enable in staging only after both representative packages, replacement,
  renderer, animation accessibility, and isolation checks pass.
- Enable authoring and rendering together once standard and assessment surfaces
  are verified.
- Roll back by disabling the flag. Existing directives remain in content and
  show the unavailable placeholder; no schema or assets are deleted.

With an asset and Embed persisted, disabling the global flag must block
authoring and Viewer launch across Manage, standard, assessment, preview, and
result surfaces while preserving assets and directives and showing the
unavailable placeholder. Re-enabling must restore rendering without migration
or data rewriting.

## Planning review record

The original planning review found valid upload, package-validation, renderer,
assessment, and isolation risks. Its separate Revision, private Viewer Session,
catalog-release, archive, revocation, and retention machinery is superseded by
the user-confirmed media-like product contract in this revision.

The renewed planner pass returned `READY_WITH_CORRECTIONS`. Its deletion,
freshness, execution-contract, and rollback clarifications are incorporated in
this revision. It confirmed that the simplified design is proportionate and
does not restore the rejected lifecycle machinery.

The planner-reviewed interaction-type frontier was accepted by the user. V1
therefore pins Course Presentation and Agamotto profiles for user-controlled
slides, controlled local motion media, and user-controlled image sequences.

## Progress

- [x] Existing H5P, editor, renderer, media, assessment, and deployment seams
  investigated.
- [x] Original security review completed.
- [x] Lecturer upload, display-only behavior, renderer coverage, and one-Embed
  placement confirmed.
- [x] Shared understanding confirmed for media-like replacement and deletion
  semantics with no product-facing Revision lifecycle.
- [x] Plan and glossary simplified around H5P Asset, H5P Embed, and H5P Viewer.
- [x] Course Presentation and Agamotto confirmed as the two supported top-level
  content types with exact pinned recursive dependency profiles.
- [x] Renewed planning review completed.
- [ ] Revised plan approved for implementation.
- [ ] Implementation started.

## Remaining product decisions

None. Explicit approval of this revised plan is still required before
implementation starts.
