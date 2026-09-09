# Biology Lab Help fixture pack

This directory is a synthetic teaching and evaluation pack for the proposed
Biology Lab Help persona. It includes a configured local draft, one exact
scoped local MCP binding, and verified deterministic retrieval from a separate
synthetic biology corpus; model answers remain untested. The model/provider
route and spend cap remain unresolved. The user approved the next evaluation
in principle, but the exact route and cap are pending asynchronous confirmation.
The current source-delivery terminal is this reviewed local synthetic retrieval
package prepared for the approved draft-PR step; scientific and model
qualification are subsequent.
No model call, source download, private material, raw data, or scientific
result is included. Local configuration verification is recorded below.

Local setup update, 2026-09-09: the prepared configuration was applied to a
verified disposable database. Dry-run wrote no chatbot; apply and readback
verified a DRAFT chatbot with this persona and disclaimer. The exact scoped
local MCP binding selects the separate biology corpus; direct signed HTTP
checks retrieved biology and finance material separately, and crossed
chatbot/KB pairs returned 401. Thirty-five focused tests passed, repeated
startup left one binding, the runtime is stopped, and no model calls were
made. The model/provider route and spend cap remain unresolved, so the chatbot
is not ready for scientific evaluation or student access.

## Staff use

The user approved the existing generic Tutor starter buttons for this prototype.
The three biology starters below remain copyable staff-guide examples. They
do not configure a biology mode or source binding automatically.

### Software help

> I am using **[PyMOL / CLC Main Workbench 26.0 / GraphPad Prism 11]**. My
> exact edition/version is **[fill in]**. I want to **[describe one task]**.
> Please use only the approved source pointer for this tool, give one short
> checkable sequence, explain why it applies, and state what the supplied
> context does not establish.

### Paper or figure help

> I supplied a synthetic teaching figure, its caption, and this question:
> **[question]**. First state what is visibly shown. Then separate the
> supplied paper claim from that observation, and list what the figure and
> context cannot establish. Do not infer function, contact, causality, or
> significance from the drawing alone.

### Result interpretation

> I supplied a plot with its legend, axes, units, context, and this question:
> **[question]**. Describe only the qualitative trend visible in the supplied
> evidence. Ask for anything missing. Do not calculate a fit or report exact
> statistics from image pixels.

For a later staff pass, choose a case in `cases.json`, paste its question,
provide only the listed synthetic context and attachment, and score the
response against its expected claims and limitations. Never send
`expected_observable_claims`, `expected_limitations`, or
`reviewer_only_observations` to the model; they are reviewer-only scoring
material. The human-readable figure descriptions are also reviewer aids and
must not replace the attachment in an image-understanding case. An expected
claim is a review criterion; it is not an observed output or a test pass.

Only cases with an actual `attachment_path` and `evaluation_surface: "vision"`
are eligible for image-contract checks. A case tagged
`evaluation_surface: "text_only_policy"` must be reviewed as a text policy
probe and must not be counted as vision robustness evidence.

## Fixture-only versus configured

| In this directory now | Requires a separate approved qualification |
| --- | --- |
| Configured draft persona and three pasteable starters | Staff validation of model answers |
| Six positive and five failure fixtures with local synthetic sources | Scientific response quality against the fixtures |
| Three static synthetic SVG teaching schematics | Actual attachment/image-context and reload behavior |
| Original synthetic teaching notes; external pointers deferred | Approved model/configuration and inference |
| Manual inspection and JSON/path checks | Staff scientific scoring and browser/runtime evidence |

The custom-mode starter limitation is accepted. Use the existing operator
script with `provision-config.json`; see [Setup](#setup). No new operator
script or shared authoring UI is needed. No student access or pilot follows
from this pack.

## Setup

`provision-config.json` is prepared input for the existing
`packages/prisma-data/src/scripts/2026-08-23_provision_course_chatbot.ts`.
Its `Biology Lab Help` prompt is copied from `persona.md`; keep both consistent
when editing. The file contains no environment identifiers or credentials.
It passed the script's input contract and was applied to the isolated synthetic
course described above. This does not authorize applying it elsewhere.

For any future replay, use an explicitly authorized isolated synthetic target.
The course display name must contain `BIOLOGY_SYNTHETIC`, and its owner must
match the supplied owner identifier. The marker is an additional guard, not
proof that a database is disposable. Use only synthetic accounts and records.
First run the existing script without `--apply` and inspect its target plan.
Even that dry run connects to the database; the isolated run described above
verified that it did not create a chatbot.

For any future replay, account for the script's full effect: it creates or updates
the named chatbot, replaces its persona set, disables model selection, clears
the allowed-model list, and creates or updates its linked disclaimer. A replay
can therefore change an existing bot. It does not preserve a pinned model
policy. Do not run it against an existing course chatbot or shared disclaimer.

The empty allowed-model list resolves through the environment's model registry
and primary-model setting. It is not an approved provider choice or cost cap.
Verify the main-response and image-description provider paths before inference.

Sources are separate records. The effective-mode resolver selects enabled
bindings whose mode is exactly `Biology Lab Help`; this custom mode does not
inherit Tutor sources. A strict Doc Query binding uses server `KB`, allowed
tool `doc_query`, and parameters `required: true`, `toolAlias: doc_query`, plus
the approved knowledge-base UUID. Verify the target server and permitted source
content before configuring it. The source manifest selects local synthetic notes;
it supplies neither a knowledge base nor permission to copy proprietary manuals.
Do not replay a production canary or cohort activation script for this setup.

After configuration, read back the persona, source binding, model policy and
disclaimer before any approved model evaluation. The verified run did so and
confirmed the single scoped binding. Qualify attachment support and Teams
separately. SVG fixtures have rendered PNG previews for inspection, but the
application upload format and full image path still need runtime validation.

## Sources and rights

The user selected synthetic material only. `source-manifest.json` selects
three original teaching notes in `sources/`: structure-display questions,
alignment/paper reading, and plot interpretation. External manual links remain
deferred references and are not selected for retrieval or import.

The notes contain no invented vendor commands or menu paths. They support
testing coaching, interpretation and evidence limits, but cannot validate exact
PyMOL, CLC or Prism procedures. Cases reference the notes by `source_id`.

The local fixture server now accepts `LOCAL_MCP_DOCUMENTS_FILE`, pointing to
`project/biology-chatbot/retrieval-documents.json` from the repository root.
The JSON embeds the three notes and their citation metadata; keep it consistent
with `sources/` when editing. Invalid configured input fails startup; leaving
the variable unset retains the finance fixture.

The focused local suite passed all 35 tests. These are local contract checks,
direct signed HTTP retrieval checks, and authentication checks, not browser
rendering or model-output proof.

The biology draft now has one exact scoped local binding to a separate biology
corpus. The ignored configuration
`project/_local/local-mcp-fixture.json` specifies `chatbotId`, `ownerId`,
`courseId`, `kbId`, `chatMode`, and `documentsFile`. Startup reads that file;
`LOCAL_MCP_FIXTURE_FILE` can select another explicit file. Keep the configuration
available for repeat startup. Removing it while its binding exists fails the
ownership check instead of silently accepting an unknown consumer.

The additional identity receives only its configured documents. Benibot retains
its separate finance identity and corpus. Signed HTTP checks passed for both;
crossed chatbot/KB pairs returned 401, and biology retrieved no finance source.
A repeated managed startup succeeded and readback confirmed one binding, DRAFT
status, the exact owner/course, and zero conversations. No inference occurred.
These checks prove local retrieval and binding, not browser citation rendering,
answer quality, image interpretation or Teams compatibility.

## Boundaries

All student and research material is fictional. The pack excludes private
data, report writing, caption generation, wet-lab optimization, raw-table
analysis, fitting plugins, project-file parsing, web search, desktop
automation, and viewer behavior. The schematics are teaching diagrams with
defined synthetic data, not screenshots from PyMOL, CLC, or Prism and not real
protein, alignment, paper, or experimental evidence.

The user approved the next evaluation in principle. It may run the six positive
cases twice on the configured model and score the five failure cases once the
exact model/provider route and spend cap are confirmed asynchronously. This
pack itself makes no claim that those runs occurred or that any chatbot
behavior passed; do not run inference before that confirmation.
