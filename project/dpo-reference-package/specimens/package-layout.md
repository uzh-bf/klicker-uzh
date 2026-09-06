# Synthetic export package

Every value is synthetic. The files use `example.invalid`, fabricated identifiers, fictional course content, and non-real dates. Do not copy production rows into this directory.

```text
specimens/
  assessment/
    assessment-results.csv
    manifest.json
  research/
    live-quiz-responses.csv
    asynchronous-question-responses.csv
    learning-analytics-groups.csv
    chat-transcripts.json
    data-dictionary.json
    manifest.json
  attestation-log.csv
  package-layout.md
```

`assessment-results.csv` follows the current Manage assessment result table. Its manifest and server-side checksum are proposed controls; the current browser-generated download does not create them.

The research files are proposed backend release projections over current Prisma models. They are not evidence that a production research exporter exists. The release must check each participant's research choice immediately before it makes the files available.

`learning-analytics-groups.csv` contains one cohort-level row per activity. It has no participant key or participant-level error details. A row with four eligible people and no metrics demonstrates the example minimum group size of five. The release must also suppress complementary values where another visible group could reveal the hidden group. The DPO must approve the final threshold and rule.

Current `v3` stores participant-level Learning Analytics and exposes participant views in Manage. Those paths are not part of this proposed product or export. They must be retired or separately authorised and disclosed before the group-only wording can ship. Existing aggregate rows also cannot be released unchanged after opt-outs; the exporter must recalculate the release projection from the current eligible population.

Project-specific pseudonyms reduce linkability but do not make participant-level quiz, learning, or chat records anonymous. Chat text can contain direct identifiers entered by participants. Treat the research package as pseudonymized personal data unless a separate disclosure assessment establishes otherwise.
