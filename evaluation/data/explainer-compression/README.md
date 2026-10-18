# Explainer compression regression

This authored German development corpus checks whether shortening preserves
technical meaning. It uses the existing version-1 Klicker trajectory format;
there is no new scorer, judge configuration or target-runtime dependency.

| Case                                | Role                                                      | Assessment                                                                                              |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `concise-notes-revision`            | Existing revision control, with its case object unchanged | Turn 2 immediately shortens notes about keys and data quality                                           |
| `null-non-null-compression`         | Precision regression                                      | Turn 2 preserves NULL/non-null distinctions under the same shortening request                           |
| `composite-primary-key-compression` | New validation case                                       | Preserve combination-level uniqueness and non-null key components                                       |
| `binary-search-preconditions`       | New validation case                                       | Preserve sorted-input, comparison and access assumptions; distinguish search from insertion             |
| `lossless-size-qualification`       | New validation case                                       | Preserve exact reconstruction scope without a universal smaller-file or information-restoration promise |
| `workflow-hold-exception`           | New validation case                                       | Preserve a fictional rule's conditions and overriding hold without inventing policy                     |

Both existing cases retain `group: development`. The control role does not change the
existing case's capture identity. These inspected examples are not holdouts.
The four additional cases use `group: reserved`: authored and unrun validation
examples, not blind holdouts. Their first prompts supply the relevant material.
No case includes a reference model answer, and both development case objects
and the original control rubric remain unchanged.
Each case requires a fresh thread; its two turns share their parent chain.
No model responses, private capture receipts or quality results are bundled.

Corpus version 1 requires a nonempty selection of unique one-based assessment
turns within each trajectory. The importer normalizes that selection to ascending
order without changing authored data. Unknown fields at the root, case or turn
level are rejected. A literal turn contains only a nonblank `message`; a repeated
turn contains only `repeatPrevious: true` and a string `suffix` after turn one.
Empty suffixes are valid and all authored text and identifiers remain exact.
This repairs validator drift without changing receipt version 2. It deliberately
rejects previously tolerated malformed corpora and sorts previously unordered
assessment metadata. Assessment turns remain diagnostic, not a judge selector.

## Review the regression

The first prompt supplies synthetic material so this case tests compression
rather than retrieval of an otherwise absent fact. Check the first answer
against that material, then assess the second answer using each corpus rubric
criterion independently: 2 satisfied, 1 partly satisfied, 0 violated, U missing
evidence. Record an answer excerpt and any supporting passage beside the score.
If turn 1 already loses a distinction, record an initial-answer failure;
do not attribute it to compression or remove it from the planned denominator.
An absent first answer makes the revision unassessed, never a pass.

Correct paraphrases are accepted. Bare wording such as "nicht leer" is
insufficient when it leaves NULL indistinguishable from an empty string.
The revised answer may explain non-null in plain language instead of repeating
an exact SQL token. An explicit claim that an empty string or zero is NULL, or
that NOT NULL alone excludes either value, violates the relevant criterion.
Mentioning NULL somewhere does not rescue a contradictory explanation.

Use the existing control's original rubric without adding a new precision
requirement to it. Assess the new case separately; do not average the two cases
into an accuracy or improvement percentage. Cite only evidence actually supplied
to the model. A hash-only source mapping cannot establish passage support or
rendered citation behavior.

The factual reference is PostgreSQL's
[not-null and primary-key constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
and its distinction between
[NULL and an empty string](https://www.postgresql.org/docs/18/rowtypes.html#ROWTYPES-IO-SYNTAX).
The example is PostgreSQL-specific rather than a claim about every SQL dialect.
That same primary-key reference supports the composite-key case. The search
case uses Python's [bisect documentation](https://docs.python.org/3.12/library/bisect.html),
which separates logarithmic search from linear list insertion. The compression
case uses the W3C [PNG lossless definition](https://www.w3.org/TR/png/#dfn-lossless):
exact reconstruction concerns data supplied to encoding, not information
discarded beforehand. A counting argument rules out guaranteed shortening of
every possible input by a lossless encoder. The workflow case is fully
stipulated and claims no real legal or organizational policy.

## Offline preparation

From the application root, validate the corpus with the existing importer schema:

```bash
python -c 'import json; from pathlib import Path; from evaluation.adapters.klicker_trajectories import _validate_corpus; _validate_corpus(json.loads(Path("evaluation/data/explainer-compression/corpus.json").read_text()), "development")'
```

Use `"reserved"` instead of `"development"` to validate only the new cases, or
`None` for all six. This is corpus/schema validation, not model-quality evidence.

This reads local files only. It does not query a target or call a judge.
Use the existing application capture adapter for any later authorized run, then
the application-owned offline importer for its strict version-2 receipts.
Keep additional private tool excerpts outside the importer receipt contract.
Capture authorization, model configuration and budget remain separate from
this corpus. Adding the cases does not authorize running them or reusing an
exhausted ledger. Model performance on the new case remains unassessed.

## Proposed broader comparison

The [current quality-decision plan](../../../project/2026-10-18-explainer-assessment-readiness-plan.md#smallest-next-capture-proposal)
supersedes the four-block proposal below: start with one baseline and one
candidate block, one repeat each, for 24 planned learner turns. Manual quality
assessment precedes any optional automated-judge calibration. Paid execution
still needs separate approval. The older 48-turn protocol is retained below as
preparation history, not an instruction to run both repetitions automatically.

The protocol and budget proposal below are retained from the original preparation.
The [current migration plan](../../../project/2026-10-17-trajectory-contract-plan.md)
owns the source boundary. Approval covers data/docs and
offline checks only, not execution of the following capture commands.

Reuse Klicker's existing `evaluation/run-tutor-trajectories.mjs`; despite its
name it already supports Explainer. No new capture or scoring script is needed.
Once separately authorized and qualified, run four serial blocks in order
baseline-1, candidate-1, candidate-2, baseline-2, each using all six cases and
`--repeats 1`. A private manual manifest binds block/arm, corpus/source/prompt
and model/fixture identity, receipt path and normalized artifact. Check IDs are
distinct and mapper provenance is consistent across files. Local repeat 0 in
each file remains truthful; preserve the external block label for comparison.

From the Klicker root, the existing runner command for the first block is:

```bash
node evaluation/run-tutor-trajectories.mjs \
  --corpus evaluation/data/explainer-compression/corpus.json --arm baseline --repeats 1 \
  --budget-file <one-shared-authorized-ledger.json> \
  --output <new-baseline-1.jsonl>
```

No `--group` filter selects all six cases. Create fresh complete two-turn
threads for each case and run; do not replay a sibling revision or inject a
recorded first answer. Both arms generate their own first answer, so the
comparison measures the full trajectory rather than isolating compression
conditional on identical generated context. Required first-turn `KB_doc_query`
completion still applies when the prompt supplies material.

Import each block separately from the application root:

```bash
python evaluation/adapters/klicker_trajectories.py \
  <new-baseline-1.jsonl> \
  --corpus evaluation/data/explainer-compression/corpus.json \
  --output <new-baseline-1-conversations.json>
```

Do not concatenate receipt files, rewrite repeat numbers or replace output.
The importer preserves planned incomplete/unstarted captures; an absent file
or rejected import stays unstarted/invalid in the manual report without
manufactured receipts. An uncertain ledger stops all dependent blocks.

Manually assess every case/repetition/arm against its own frozen rubric using
2/1/0/U, with excerpts and actual supplied passage support. Record first-answer
failures separately, and preserve all 24 planned trajectories and 48 learner
turns in coverage. New cases are reported separately from development examples.
`assessmentTurns` is diagnostic metadata, not an automated turn selector. The
framework does not currently ingest per-criterion manual scores or generate
their report: write a private Markdown table alongside normalized captures,
without adding another reporting implementation.

Inspect each emitted citation in the actual model-visible and persisted tool
passage. Hash-only mapping and completed retrieval do not establish support.
Facts supplied only by the user should not receive an unrelated KB citation.
The unchanged synthetic retrieval fixture is not a real-course retrieval test.
Framework judge evaluation/reporting remains available as a separate workflow
outside this manual plan; its budget authority is separate from the 48-turn
capture cap and it still needs a qualified hard predispatch cap.

Exploratory acceptance requires all assessed candidate criteria satisfied,
supported emitted citations, no new contradiction and no regression on either
development example. Incomplete coverage is inconclusive. Report criterion
changes and failure modes without aggregate accuracy, causal improvement,
statistical-significance or learning-outcome claims. Do not tune the candidate
on the results and rerun the same reserved set as an untouched validation set.

## Proposed spending boundary

Propose a new incremental $55 hard reservation cap for later approval. Six
cases x two arms x two repetitions x two turns = 48 learner turns; at two
provider requests per turn and the recorded 499,351 microUSD request bound,
the nominal reservation is $47.937696. The cap accommodates at most 110 such
requests, 14 above the nominal 96. This is conservative admission capacity,
not a prediction of token charges. Fresh qualified prices may change it.

[Klicker PR 6576](https://github.com/uzh-bf/klicker-uzh/pull/6576) merged the
exact $55/48-turn initializer option while preserving the $5/120-turn default.
Runtime readback and fresh pricing/routing qualification remain execution
prerequisites; source support does not authorize a paid run. Do not split into
multiple ledgers, reduce bounds or refund reservations to bypass the cap.
Preserve all older ledgers. Additional request headroom does not recover
uncertainty or authorize extra learner-turn retries. No ledger is initialized,
runtime started, paid model/judge called or deployment performed by this
preparation.
