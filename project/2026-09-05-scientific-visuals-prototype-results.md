# Scientific visuals: first execution results

The local experiments establish small-molecule and reaction rendering, expose
biology presentation and metadata limitations, and disprove the proposed media
cleanup guarantee. The follow-up resolves standalone Ketcher readiness and
exports native previews for all five kinds. Biology presentation, loading cost
and storage ownership still prevent production integration.

These results follow the [reviewed plan](plans_wip/2026-09-03-scientific-visuals-plan.md).
The user authorized review improvements and initial execution on 2026-09-05.
The first experiment changed no application code, repository dependency,
database or cloud resource. The subsequently approved chemistry notation package
changes local application source and dependencies; its verification is tracked
in the plan. No cloud changes are authorized.

## Rendering experiment: answered with capability limits

Question: can the selected engine produce a PNG and preserve structured source
for molecule, reaction, peptide, DNA and RNA inputs?

Environment: Linux aarch64 in a disposable Docker container limited to one CPU
and 1 GiB memory, with networking disabled during rendering. Python 3.12.12 and
`epam.indigo==1.46.0`; engine reports
`1.46.0-00000000-aarch64-linux-gnu-10.5.0`.

The slim Python base initially failed with `libfreetype.so.6` missing. The local
image adds FreeType, Fontconfig and DejaVu fonts. This is a runtime dependency
finding, not a production image recommendation. Source inputs are synthetic.

| Kind / input | Import and KET reopen | PNG outcome | Projection fidelity |
| --- | --- | --- | --- |
| Molecule / SMILES | Passed; equal parsed KET JSON | 21,998 bytes; visible acetylsalicylic-acid structure | Canonical SMILES equal |
| Reaction / reaction SMILES | Passed; equal parsed KET JSON | 9,163 bytes; visible reactant/product diagram | Canonical reaction SMILES equal |
| Peptide / FASTA | Passed using monomer library and `loadKetDocument` | Direct document render rejected; molecule-import path emits monomer labels | Sequence symbols equal; FASTA header changed |
| DNA / FASTA | Passed using monomer library and `loadKetDocument` | Direct document render rejected; molecule-import path emits sugar/base/phosphate labels | Sequence symbols equal; FASTA header changed |
| RNA / FASTA | Passed using monomer library and `loadKetDocument` | Direct document render rejected; molecule-import path emits sugar/base/phosphate labels | Sequence symbols equal; FASTA header changed |

An additional peptide HELM input also preserved KET and HELM through document
reload. Malformed SMILES was rejected with `cycle 1 not closed`.

All emitted PNGs were 1000 × 500 pixels and repeated byte-for-byte within the
same process. The final run took approximately 17–37 ms per valid fixture for
the measured import/export/reload/render work, excluding engine and library
initialization. These six small inputs provide no percentile, concurrency,
cold-start or capacity qualification.

An empty monomer library rejects the FASTA inputs. The successful run uses the
upstream public library at Indigo commit
`a33c5afe44410245ba456ab63fd0d785d2f8b3de`, path
`data/molecules/basic/monomer_library.ket` (2,600,692 bytes; SHA-256
`ebe70f351fc62cc0d2a9393c9c48521356dd34ffdc324f9d63da1e91e28aae29`).
This library is a separate versioned input; it must not drift independently of
the production renderer without qualification.

Visual inspection matters: the peptide image displays `F—G—A` left-to-right
for input `AGF`, without terminal direction labels. The DNA image is a generic
connected-label diagram, not a sequence view. These are unsuitable evidence
for a biologically clear sequence presentation. A dedicated sequence/layout
path must establish orientation, terminal labels and intended readability.

FASTA export after KET reload changes `>synthetic` to `>Sequence1`; residue
symbols survive unchanged. Preserve relevant sequence metadata separately or
declare that normalization explicitly. Do not equate equal sequence symbols
with exact original FASTA replay. Generic `loadMolecule` also changes the
macromolecular KET representation; use the document API for that source type.

The source/preview experiment records hashes for one molecule source, its own
PNG, and a different valid reaction PNG. Both images have valid PNG signatures.
Independent hashes alone do not establish that a supplied image depicts the
stored source. The next production design must choose trusted regeneration or
an explicitly author-asserted association. No application validation was tested.

## Editor experiment: build answered, integration inconclusive

The disposable React 19.2.0 / Vite 7.1.5 page uses Ketcher React, Core and
Standalone 3.18.0 with Indigo Ketcher 1.46.0. It loads the editor dynamically
when the user chooses Open editor. The page has synthetic test controls for
molecule, reaction, peptide, DNA and RNA.

The initial build failed because `EventEmitter` was not exported by Vite's
browser-external placeholder. Adding `events==3.3.0` and its browser alias
resolved that build failure. Browser startup then reported
`ReferenceError: process is not defined` in the transitive util/assert path.
The scaffold adds `process==0.11.10`. pnpm initially rejected the esbuild
installation script; explicitly allowing that one build and rebuilding it
completed setup. These are isolated experiment dependencies only.

The final production-mode build succeeds, but browser acceptance does not:
the page mounts the editor container and remains at Waiting for editor with
disabled test controls. A readiness wait expired after 25 seconds. The visible
container measures 1264 × 650 pixels; it is not a zero-height container. No
claim is made about the cause of the remaining initialization gap. The earlier
process error alone does not explain the final observed state.

The final build reports:

| Asset | Raw bytes, approximately | Gzip bytes, approximately |
| --- | ---: | ---: |
| Entry JavaScript including React | 198,720 | 62,540 |
| Main lazy editor JavaScript | 28,804,310 | 8,444,450 |
| Additional lazy JavaScript | 1,679,430 | 473,880 |
| Editor CSS | 183,340 | 28,770 |

At 10 Mbps, transferring the main lazy chunk alone takes about 6.8 seconds
before parsing or initialization. The five-second cold-open target is therefore
not achievable for this exact bundle under the proposed test conditions.
The entry size is not an incremental Manage bundle measurement. This experiment
does not establish Next.js, Slate, linked routes, macromolecule export, keyboard
behavior, mobile usability, or accessibility. It does not select a production
Ketcher version. Managed application runtime startup is not justified until the
standalone readiness gap is understood.

## Editor follow-up: readiness and native exports work locally

A browser `ReferenceError: global is not defined` in Redux prevented `onInit`.
The isolated scaffold now sets `globalThis.global = globalThis` before loading
Ketcher. This resolves readiness with the same pinned editor versions; it is
not an approved application shim or evidence of Next.js compatibility.

All synthetic examples reopen and export a native PNG:

| Kind | Preview dimensions | PNG bytes | KET text after reopen |
| --- | --- | ---: | --- |
| Molecule | 224 × 151 | 3,872 | Changed |
| Reaction | 293 × 33 | 1,964 | Changed |
| Peptide (AGF) | 95 × 19 | 532 | Equal |
| DNA (ACGT) | 269 × 59 | 1,337 | Equal |
| RNA (ACGU) | 256 × 59 | 1,187 | Equal |

Editor screenshots show colored sequence diagrams. The exported biology PNGs
are much smaller plain-label diagrams. Reopen and byte equality do not prove
scientific correctness, sequence direction or source/preview equivalence.
The failed cold-open transfer budget remains unchanged. Manage integration,
keyboard behavior and mobile usability remain unverified.

The receipt is
`/private/tmp/klicker-scientific-prototype-ChOK6F/followup-20260905-receipt.json`.
Native exports remain in that directory's `output/` folder. The executor closed
its browser and reported the editor container stopped with exit 143.

## Media lifecycle experiment: proposed guarantee disproved

The executable abstract model runs four schedules. It has one synthetic
reservation and symbolic staging/final objects, with no actual storage or
database. Two schedules show objects without a retry record:

- A finalizer pauses after claiming the row. Cleanup marks it deleting,
  deletes objects and removes the row. The finalizer resumes external
  publication and creates an orphan.
- A previously issued staging write grant is still valid after cleanup deletes
  the object and row. Its later write recreates an orphan.

Retaining deletion/attempt identity preserves recoverability in the model, but
does not revoke credentials or establish eventual deletion. The experiment
therefore ends with a counterexample. Blob/database adapter implementation,
transfer and erasure race qualification wait for an actual fencing protocol;
the model does not prove these behaviors.

Current source review independently confirms that MediaFile belongs to User,
whole-account transfer updates its owner without moving its stored URL, and
individual element transfer does not transfer media. Current course deletion
has request-based guards and may retain detached live quizzes. Copying or
sharing visual-bearing content needs an explicit reference/retention decision
before the proposed media migration is frozen.

## Recommended next package

Proceed first with chemistry notation parity using the existing Markdown and
Chat renderers. This provides usable formula/reaction notation and is independent
of visual storage, but it does not satisfy the requested molecular visuals by
itself. Its scoped local implementation is approved and in progress; application
verification and reviews remain required before delivery.

Continue the visual track by qualifying native macromolecule presentation and
application integration. Keep the current five-second target as
failed for this bundle; select a smaller asset strategy or present a measured
loading trade-off before implementation. Separately, choose trusted preview
generation and a storage fencing/reference-retention protocol before any visual
persistence migration. Do not silently reduce biology to molecule diagrams.

Chat rendering research can continue locally. Full stream/persist/reload/revision
integration waits for the [authoritative-history prerequisite](https://github.com/uzh-bf/klicker-uzh/pull/5676),
still open with no merge commit at the September 5 inspection.

## Reproduction and evidence custody

Standalone source and locked dependencies remain in
`/private/tmp/klicker-scientific-prototype-ChOK6F`. `render.py`, `lifecycle.py`,
the React scaffold, Dockerfile and pnpm lockfile are retained as runnable
experiment evidence. They are not production source.

Example renderer command, using the retained local image:

```sh
docker run --network none --cpus 1 --memory 1g --cap-drop ALL \
  --security-opt no-new-privileges \
  --mount type=bind,src=/private/tmp/klicker-scientific-prototype-ChOK6F,dst=/work \
  -e PYTHONPATH=/work/deps scientific-visuals-prototype:20260905 \
  python /work/render.py
```

Replace `render.py` with `lifecycle.py` for the state model. Package acquisition
uses networked setup containers; renderer and lifecycle runs use `network=none`.
The browser server binds only host loopback on port 43185 during verification.

At the first experiment checkpoint, lifecycle readback confirmed all task
containers were exited. The browser server
exited with 143 after the explicit stop; final renderer, state-model and editor
build containers exited with zero. Earlier failed attempts remain available as
diagnostic evidence. The browser session is closed. No managed DevPod/devrouter
runtime was touched at that checkpoint, and no container, image, worktree or
retained data was deleted. The later chemistry package uses the exact managed
task worktree runtime; its current lifecycle is recorded in the plan.

Local receipts and images are copied to
`project/_local/scientific-visuals-2026-09-05/`; review dispositions are in
`project/_local/reviews/2026-09-05-scientific-visuals-senior-review.md`.
All application integration and production performance claims remain unproven.

Documentation consulted: [Ketcher API](https://github.com/epam/ketcher),
[Indigo API](https://lifescience.opensource.epam.com/indigo/api/index.html),
and [Python SDK](https://lifescience.opensource.epam.com/indigo/api/python_ref.html).
Current Context7 queries were supplemented with installed package source where
the generic examples did not establish macromolecule behavior.
