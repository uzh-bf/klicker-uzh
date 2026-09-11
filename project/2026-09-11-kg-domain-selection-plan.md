# Domain selection for knowledge-graph generation

## Approval summary

Lecturers should select a subject domain beside graph quality before building a knowledge graph. The UI should preview the node categories that the selected domain will use. One versioned domain policy must govern extraction, cleaning and the resulting graph's recorded provenance.

The current UI sends only quality. The generator has six cleaning profiles, but those profiles do not select node categories. Its newer worker branch already supports versioned policies, currently for Finance and General Academic. Reuse and complete that mechanism rather than introducing another prompt selector.

Agreed scope: Finance, Economics, Business Administration, Mathematics, Informatics, and General / Mixed. The user confirmed support for all six domains on 2026-09-11. Complete each domain's English and German policy before making it selectable. Preserve Finance for legacy builds and omitted arguments. Keep the current German generation language explicit; UI locale must not silently change graph language. A language selector, editable prompts, custom node types and wider question-generation settings are outside this package.

Changing the dropdown only changes the next requested build. Existing published graphs remain available until a replacement succeeds. Each queued build freezes its selected policy version. Retries must reuse it.

Success means the UI preview, stored build, worker input, extraction and cleaning all use the same domain and categories; switching domains cannot contaminate another build's prompts. Malformed explicit-policy output will fail rather than silently assign an unrelated node category; legacy callers retain their existing behavior. The user approved source implementation and draft delivery on 2026-09-11. The terminal condition is verified source delivery with required reviews and draft PR/MR evidence. The user approved the exact branch topology below on 2026-09-11; merging, publishing worker images, deployment and paid live generation remain excluded.

## Execution details

### Verified baseline and evidence

Inspected on 2026-09-11 after fetching remote refs. Klicker's primary checkout is on `v3` and does not contain this feature. The relevant feature baseline is `origin/v3-ai` at `41038e8b5b5b46d8953017a697917613fa7170fc`; implementation target selection must be rechecked before execution.

- `packages/kb-management/src/components/KnowledgeGraphPanel.tsx:358` sends `{ kbId, qualityTier }`. Its graph controls are around line 480.
- `packages/graphql/src/services/knowledge.ts:2788` implements rebuild requests. The build ledger in `packages/prisma/src/prisma/schema/knowledge.prisma:201` records quality and immutable source identity, but no domain selection.
- `packages/hatchet/src/kbGraphIngestionApi.ts:60` and `packages/hatchet/src/kbGraphIngestion.ts:486` define and construct provider input. They omit domain, course profile, language and entity types. The provider therefore supplies its defaults.
- Provider `origin/main` is `7480c7f52eb989d8c574ebde09ee54f331f31c10`. `lightrag_research/lightrag_scripts/constants.py:94` has language-specific finance categories and six separate cleaning profiles. `hatchet_workflows/tasks.py:324` chooses categories from language rather than profile.
- Provider `feat/question-generation-hatchet-workflow` is `6e221f8e57dbcc042058cebc21c2424a065bc185`, still in open MR !4. `hatchet_workflows/domain_policy.py:146` supports `finance` and `general-academic`, both version 1; `tasks.py:214` freezes resolved policy and recipe, and `tasks.py:448` passes these into the pipeline. This is source evidence, not proof that a deployed worker supports it.

The provider's existing ADR 0001 selects versioned domain policies. Klicker ADR 0011 assigns product state and authorization to Klicker and KG runtime ownership to Catalyst. The actual inspected adapter calls the external Hatchet generator directly; do not invent a new Catalyst proxy for this feature.

### Primitive impact

| Product primitive | Disposition | Contract change and owner |
| --- | --- | --- |
| Content Domain Policy | Extend | Generator owns curated, versioned extraction and cleaning semantics; complete the four missing specialist policies. |
| Knowledge-graph build | Extend | Klicker freezes policy ID, version and generation language with each requested build; provider records its resolved policy and recipe. |
| Knowledge base and published graph | Reuse | Existing ownership, opt-in, active-build slot, quota and atomic publication rules remain authoritative. A dropdown edit does not mutate the published graph. |

### Product behavior and catalog

Use a labelled Domain dropdown beside Quality, followed by read-only node-category chips and concise help text. Restore selection from the latest requested build, matching the existing quality-control pattern; use visible Finance for legacy/no-build state. Disable changes and duplicate submission while a build is active. Show the published build's domain separately when it differs from the latest attempt; a failed rebuild must not relabel the served graph.

The generator owns the catalog. Generate a small versioned JSON manifest from its policy definitions for Klicker's server to consume, and return supported options through the existing authorized graph-config query. The browser must not own a second category map or receive prompt bodies. The catalog includes stable ID, policy version, localized label keys, supported languages and category names/definitions. Category chips use the selected version's German generation-category names even in English UI; translate surrounding labels and explanations, not the values that generation uses. Unsupported or retired selections remain visible as historical values, disable submission, and require an explicit replacement selection. Reload and catalog refresh must not silently substitute versions.

Provider exporter: `lightrag_research/scripts/export_domain_catalog.py`; curated export: `lightrag_research/contracts/kg-domain-catalog.v1.json`; reviewed consumer copy: `packages/knowledge-graph/src/domainCatalog.json`. These are proposed new files. Keep prompt bodies out of the export. The export contains a catalog revision and digest. Add `KB_GRAPH_DOMAIN_CATALOG_REVISION` as a non-secret capability gate in the backend and general-worker configuration. A missing or mismatched revision exposes only the legacy path; it must not claim a newer policy is supported. Include the new key in `turbo.json` and the existing chart configuration when implementation is authorized. Keep the current Hatchet workflow name and tenant; no new service or workflow lane is required.

Release order is worker first, then capability activation. Release evidence binds the catalog digest to the exact worker image and proves that every eligible worker for the configured workflow supports all advertised ID/version pairs. During a mixed-version rollout advertise only the verified intersection, normally the legacy path until rollout finishes. Published policy versions remain immutable and are retained in successor workers. Queued builds keep their stored selection; a worker upgrade must retain every version referenced by queued/running builds. Before rollback, disable new selections and verify that the target image supports those versions; otherwise drain affected builds under the capable image before rollback. These deployment operations require separate authority.

If a pinned version becomes unavailable after reservation and before provider acceptance, fail through existing compensation and release the reservation. Preserve the existing ambiguous-dispatch hold after uncertain acceptance. A provider rejection or generation failure after acceptance follows the existing terminal accounting path, including actual costs. Never remap the build to Finance or another version. Validate catalog/config mismatch at the general-worker effect boundary as well as before quota reservation.

The initial scope is implemented through the category definitions below. Finance and General / Mixed reuse their existing immutable policies; the four new policies are version 1:

| Domain | Policy work |
| --- | --- |
| Finance | Retain existing version-1 categories and semantics. |
| General / Mixed | Reuse `general-academic`, with a reviewed mapping from legacy `general`. |
| Economics | Define categories covering concepts, theories/models, methods, indicators, institutions and policies. |
| Business Administration | Define categories covering concepts/frameworks, methods, metrics, processes and organizational roles. |
| Mathematics | Define categories covering definitions, structures, axioms/theorems, proof methods and formulas. |
| Informatics | Define categories covering algorithms, data structures, languages, tools, protocols and architectures. |

Use the following precise category names and definitions as the reviewed implementation catalog. Keep published policy versions immutable. The user selected the six-domain scope; a two-domain release does not satisfy the agreed outcome. Do not expose six choices by silently mapping four of them to General Academic.

#### Category definitions

Keep the existing Finance and `general-academic` version-1 policy records byte-for-byte unchanged, including both language definitions and guidance. Finance retains Concept/Konzept, Method/Methode, Metric/Kennzahl, Institution/Institution, Instrument/Instrument, Regulation/Regulierung and Formula/Formel. General / Mixed retains Concept/Konzept, Theory/Theorie, Method/Methode, Process/Prozess, Measure/Messgröße, Institution/Institution and Formula/Formel. Display order is presentation only, never a fallback classification rule.

For the four new policies, the names below are canonical node-category values. Translate each definition faithfully into German in the provider policy; the meaning must remain identical across languages.

| Economics category (English / German) | Definition |
| --- | --- |
| Concept / Konzept | An economic idea or phenomenon. |
| Theory / Theorie | A general system explaining economic phenomena. |
| Model / Modell | A simplified economic representation with explicit assumptions. |
| Method / Methode | A procedure for economic analysis or empirical identification. |
| Indicator / Indikator | An observable or calculated economic measure. |
| Institution / Institution | An enduring rule system or institutional arrangement. |
| Policy / Wirtschaftspolitische Maßnahme | An economic intervention or policy program. |
| Formula / Formel | An explicit mathematical relationship in economics. |
| Actor / Akteur | A person, organization, country or economic decision-making role. |
| Dataset / Datensatz | An identifiable collection of empirical observations. |
| Case / Fall | A concrete event or situation taught through economic analysis. |

A named central bank is an Actor; its mandate or institutional arrangement is an Institution. A theory explains generally; a model represents a specified system. Keep actors, datasets and historical cases when the course teaches their role. Preserve nominal/real, micro/macro, correlation/causation and indicator/policy distinctions.

| Business Administration category (English / German) | Definition |
| --- | --- |
| Concept / Konzept | A general business idea or phenomenon. |
| Framework / Bezugsrahmen | A structured model for business analysis or decisions. |
| Method / Methode | A deliberate procedure for a business task. |
| Metric / Kennzahl | A quantified business performance or condition. |
| Process / Prozess | An ordered sequence of business activities. |
| Organizational Role / Organisatorische Rolle | An abstract position with responsibilities. |
| Actor / Akteur | A concrete person, organization or organizational unit. |
| Product / Produkt | An offering, service or brand studied in business context. |
| Case / Fall | A concrete business situation or decision. |

A manager's position is an Organizational Role; a named manager is an Actor. A company is an Actor and its restructuring is a Case. Preserve strategy/business model, revenue/profit, leadership/management, organization/department, customer/segment and accounting/controlling distinctions.

| Mathematics category (English / German) | Definition |
| --- | --- |
| Definition / Definition | A statement fixing the meaning of a term. |
| Structure / Struktur | A mathematical object equipped with relations or operations. |
| Axiom / Axiom | A statement assumed within a formal system. |
| Theorem / Satz | A proven proposition, including lemmas and corollaries. |
| Proof Method / Beweismethode | A general technique for establishing a proposition. |
| Formula / Formel | A symbolic equality, inequality or mathematical relationship. |
| Algorithm / Algorithmus | An explicit computational procedure. |
| Example / Beispiel | A concrete illustration, including counterexamples. |
| Concept / Konzept | A mathematical property or notion. |
| Notation / Notation | A symbol or convention expressing mathematical meaning. |
| Operator / Operator | An operation acting on mathematical objects. |

Uniform convergence is a Concept; a statement defining it is a Definition; its symbolic convention is Notation. Extract distinct objects only when the source actually treats them separately. Keep theorem/lemma/corollary identities distinct even though they share a category. Preserve derivative/gradient, group/subgroup, convergence/uniform convergence and general/special structures. An equation number alone is metadata, not a Formula.

| Informatics category (English / German) | Definition |
| --- | --- |
| Concept / Konzept | A general computing principle or abstraction. |
| Algorithm / Algorithmus | An explicit procedure for solving a computational problem. |
| Data Structure / Datenstruktur | An organization of data and its access operations. |
| Programming Language / Programmiersprache | A formal language for executable operations or queries. |
| Tool / Werkzeug | A concrete software system or reusable implementation. |
| Protocol / Protokoll | Rules governing communication between participants. |
| Architecture / Architektur | The structural organization of system components. |
| Interface / Schnittstelle | An exposed interaction contract, including APIs, functions and commands. |
| Data Format / Datenformat | A convention for encoding or exchanging data. |

JSON is a Data Format, NumPy and pandas are Tools, and `read_sql_query` is an Interface. Databases and operating-system implementations are Tools; their abstract organizing principles may be Concepts or Architectures. Preserve list/array, process/thread, class/object, library/package, compiler/interpreter and interface/implementation distinctions.

Across the four new policies, keep concrete named entities when they contribute to a learning objective. Exclude incidental mentions, citation markers, navigation and administrative text. Classify by meaning in context, preferring an applicable specific category to Concept. Sharing a category does not make two entities synonyms. Freeze this guidance into each new policy instead of importing mutable legacy profile text at runtime. No new question-generation settings are exposed; any question guidance required by the existing policy schema remains domain-appropriate and grounding-preserving.

The full preview displays every category, including domains with more than eight. The graph viewer's existing capped legend is not an exhaustive policy catalog; type values remain available in node details. Verify that behavior without redesigning graph colors or shapes.

### Binding technical contracts

1. Add `domainPolicyId String?`, `domainPolicyVersion Int?` and `domainPolicyLanguage String?` to `KBGraphBuild` in one generated Prisma migration; nullable historical values mean the documented legacy Finance/German behavior. Do not manufacture resolved-policy digests for historical graphs. No separate KB preference table is needed. Update analytics schema mirror and generated GraphQL SDL/documents through repository tools. Preserve existing persisted operations; add `QGetKbKnowledgeGraphDomainConfig.graphql` and `MRebuildKbKnowledgeGraphWithDomain.graphql` for the updated panel.
2. Extend the rebuild mutation and graph config. Omitted selection leaves all three fields null and retains the legacy request. Explicit selection validates the supported ID, positive integer version and language before financial effects, then stores all three atomically with build creation. Enforce all-null or all-present at request creation and dispatch; never strip an explicit selection to bypass a capability mismatch. Dispatch reads this snapshot, never current UI state or a mutable default. Keep `sourceContentDigest` strictly a digest of source content; domain selection is separate provenance.
3. Send `domain_policy` with explicit `template_id` and `template_version`, plus explicit language. Do not send a redundant `allowed_entity_types` override. Preserve the present schema-v1 model/quality route: the provider accepts domain policies in v1, while switching to v2 would reject the current explicit model fields and expand scope.
4. Resolve one policy for all generation stages. The newer provider still passes a default Finance `course_profile` alongside domain-policy guidance. For explicit policies, derive any necessary legacy profile consistently or suppress that legacy guidance; never combine a non-Finance policy with implicit Finance cleaning. Retain the legacy caller behavior when no policy is supplied, distinguishing omission from the default-valued policy model. Rows with no recorded policy retain the legacy request shape; omit new fields while the capability gate is inactive.
5. Eliminate cross-build prompt accumulation in the touched extraction path. `lightrag_functions.py:335` mutates module-global `PROMPTS` and prepends strict category instructions on each call. Use fresh per-build prompt composition/isolation and policy-aware allowed-category enforcement. Prove sequential and overlapping runs cannot inherit another domain's instructions; do not treat restoring globals after a call as concurrency isolation.

For explicit-policy builds, allow case normalization to a canonical category, then reject unknown or blank category values before graph export/publication. Re-read the effective final graph after any attempted normalization; logged update errors are not success. Do not silently relabel to the first sorted category or delete nodes to make validation pass. This intentionally makes malformed explicit-policy builds fail while preserving the existing published graph and ordinary actual-cost settlement. Legacy callers retain their current behavior. Add a structured failure code and tests for unknown, blank and failed-normalization cases. This stricter failure policy was included in the approved source plan.

The existing provider recipe/bundle remains the source of resolved-policy provenance. Preserve its binding through graph publication and downstream consumption. For GraphML-only builds, retain the requested policy ID/version/language in Klicker's ledger. Do not make optional generation bundles mandatory merely to add the dropdown.

### Delivery sequence and ownership

One coherent product package spans two repositories. The source implementation is approved. The topology below is approved. It preserves the ready generator MR and uses the existing Klicker worktree for both local stack layers.

| Package | Branch and target | Delivery |
| --- | --- | --- |
| Generator policies and catalog | New `rs/kg-domain-selection`, based on provider `6e221f8e57dbcc042058cebc21c2424a065bc185`, targeting `feat/question-generation-hatchet-workflow` | New dependent draft MR; preserve [existing MR !4](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/4). |
| Klicker build/API contract | Existing `rs/kg-domain-selection-plan`, targeting `v3-ai` | Bottom draft PR in a native GitHub stack. |
| Klicker selector UI | New `rs/kg-domain-selection-ui`, targeting `rs/kg-domain-selection-plan` | Top draft PR in the same native stack. |

The provider worktree will be `/Volumes/HOME/Git/klicker/kg-content-generation/trees/rs/kg-domain-selection`. Both Klicker layers use `/Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/kg-domain-selection-plan` sequentially. Main is the sole topology owner. GitHub stack support and `glab stack` availability were verified; the single provider package does not require restructuring MR !4. If the provider prerequisite lands first, verify ancestry and retarget the draft only with the applicable authority.

#### Delegation Map

Main owns domain semantics, integration, external effects and review disposition. Each slice has one execution owner. Executors stop at unresolved product decisions or work outside their listed paths.

| Slice | Owner | Depends on | Acceptance |
| --- | --- | --- | --- |
| 1. Complete the domain catalog and isolate policy use | executor | Reviewed category definitions and current provider branch | Six policies resolve; extraction and cleaning agree; malformed explicit categories fail; prompts remain isolated. |
| 2. Freeze domain selections in the build/API contract | executor | Stable provider catalog/contract | Catalog, migration/mirror, GraphQL, dispatch, capability configuration and tests agree; legacy clients remain supported. |
| 3. Add the lecturer selector and preview | executor | Klicker foundation | UI, i18n and browser checks cover selection, reload, version retirement and published-versus-attempted domain. |
| 4. Integrate, review and deliver | main | All slices integrated | Required reviews, exact-head CI and draft delivery in both repositories; no live deployment. |

Slice 1 owns provider `hatchet_workflows/domain_policy.py`, `schemas.py`, `tasks.py`, `workflow.py`, touched `lightrag_scripts/{pipeline,lightrag_functions,kg_cleaner}.py`, the exporter/catalog, relevant provider tests and Hatchet README. Its execution uses a trusted route because the complete source scope is private.

Slice 2 owns Klicker `packages/graphql/src/schema/{kbKnowledgeGraph,mutation}.ts`, `src/services/knowledge.ts`, the two new operations, Prisma `knowledge.prisma` and its generated migration/mirror, `packages/hatchet/src/kbGraphIngestion{,Api}.ts`, `packages/knowledge-graph/src/domainCatalog.json` and its typed reader, `turbo.json`, `deploy/charts/klicker-uzh-v3/values.yaml` and the existing backend/general-worker ConfigMap templates in that chart, `docs/async-and-workers.md` and affected contract tests. Chart defaults leave the new capability inactive; no deployed values are activated.

Slice 3 owns `packages/kb-management/src/components/KnowledgeGraphPanel.tsx`, German/English i18n, browser additions in `playwright/tests/Y-kb-management-ux.spec.ts`, synthetic fixtures and screenshot evidence. Slice 4 owns integration and returns defects to the relevant slice. Keep one writer per path set. Apply simplifier, cross-system slice review and integrated final review to the applicable committed scopes.

Source delivery stops at reviewed drafts with exact-head CI and browser evidence. A compatible worker must later be released and activated under separate authority. Rollback disables new selections and preserves existing graphs/build records; it does not rewrite historical policy versions. If verification is blocked, finish independent authorized work and report the exact missing capability rather than marking the package complete.

### Verification portfolio

| Risk | Existing home | Change |
| --- | --- | --- |
| Wrong policy, category or unsupported version | Provider `test_domain_policy.py`, `test_domain_graph_pipeline.py` | Extend structured resolution, extraction/cleaning agreement and final graph validation, including unknown/blank types and failed normalization. Category IDs are contracts; do not pin prompt prose. |
| Prompt contamination between builds | Provider extraction integration tests | Add one synthetic sequential/concurrent regression using disjoint policy categories and captured effective calls. |
| Selection lost, changed on retry, or charged before rejection | `knowledgeGraphConfig.test.ts`, `knowledge.test.ts`, `kbGraphIngestion.test.ts` | Extend build creation, invalid selection, persisted dispatch/retry and legacy-default coverage. Reuse existing auth/quota/publication tests. |
| Display mismatches served graph | Extend `playwright/tests/Y-kb-management-ux.spec.ts` beyond its existing collapsed-settings check | Exercise select/preview/submit/reload, retired versions, catalog refresh, active state and failed rebuild with an older published domain. German category values remain the same in both UI locales. Capture desktop/mobile and German/English UI variants with synthetic data. |
| Preview differs from provider | Catalog and provider contract fixture | Validate the catalog export against resolved policy categories and the exact external request against the provider model. Add catalog/worker mismatch, mixed-worker capability intersection, queued retry across upgrade and post-reservation unavailability cases. Avoid copied expected prompt strings. |

Run native formatting/type/schema checks in the supported container when implementing. Start only the managed runtime needed for browser verification and stop it afterward. Use mocked provider calls for deterministic checks; a paid live LLM smoke test requires explicit authority. A mock result is never evidence of real generation quality. Include inline screenshot evidence in the eventual UI PR.

Update `docs/async-and-workers.md` for the frozen domain dispatch contract and the provider's Hatchet README for policy/catalog compatibility. Existing ADRs already own the boundaries; a new ADR is unnecessary unless implementation changes those owners or versioning semantics. Update a task skill only if its described workflow becomes inaccurate. The manage runtime is ready at the exact source path under DevPod ID `rs-kg-domain-selection-plan`; main owns shutdown after final browser checks. Generator focused tests passed (97), scoped Ruff and contract formatting passed, catalog export matches, and historical policy records are unchanged. No paid generation ran.

### Working context and progress

Planning worktree: `trees/rs/kg-domain-selection-plan`, branch `rs/kg-domain-selection-plan`, based on the recorded `origin/v3-ai`. Artifact root: `project/`. Plan approved; implementation and verification are active. Existing primary-checkout files were preserved.

Approval mode: executable batch for the approved source scope, including the approved exact topology. Boundary owner: main. Terminal: reviewed source implementation, required verification and draft delivery in both repositories. Merge, worker image publication, deployment, real-data access and paid live generation remain excluded. The six-domain scope and general implementation direction are approved; do not ask for them again.

Current status: category and execution addendum approved by the independent native planner after fresh source verification. Earlier direction-plan review passed; its unchanged evidence remains reusable. The same native planner requested complete category coverage, all-null/all-present persistence, bounded layer ownership and updated authority wording; those corrections are incorporated here. The optional earlier AGY challenge returned no usable review and is not counted as evidence. Review dispositions are in `project/_local/reviews/2026-09-11-kg-domain-selection-plan-hardening.md`.

Implementation active under the user-requested native goal. The provider worktree now exists at the approved ref. Main owns provider implementation because its complete private scope is ineligible for the external executor. The public executor owns the build/API foundation, with main supplying the canonical catalog and generating the migration. UI remains dependent on the foundation. Generator implementation is committed at `c167315ce9d0a940d956a63078a19ff662a86a31`, with accepted simplification at `4da27df`; its focused follow-up has 9 passing pipeline tests. Trusted native slice review is running; native simplifier report is recorded. Foundation work is uncommitted. Generated migration `20260911204500_kb_graph_domain_policy` contains only three nullable columns; normal migrate-dev stopped on pre-existing default/index drift, so Prisma schema-to-schema diff generated the migration. Guarded additive schema push and client regeneration passed; analytics mirror is synchronized. GraphQL codegen and Hatchet check passed; foundation type/test integration remains active.

Generator draft: [six versioned generation domains](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/15), head `60b5129cbffaa0d7a80a2bcd3cf83b2fd134acf1`. Slice review corrections verified; integrated final review and exact-head CI remain pending. Generator package has 1,413 added / 79 removed substantive source/test lines (generated catalog and README excluded). One cohesive policy-to-export contract retains the approved dependent-MR topology. Foundation and selector remain uncommitted. Synthetic lecturer fixture restored after the DB test cleanup removed seeded rows; no more database suites may overlap browser verification.
