# TutorBench Retrieval Contract

This contract defines the retrieval boundary TutorBench should validate before a
live LightRAG/Milvus integration is available in this branch. Fixture-backed MCP
responses should use the same shape so eval results can move from fixture to
real retrieval without changing the scoring logic.

## Current Constraint

- The real LightRAG and Milvus integrations are not available here yet.
- The next validation slice is fixture-backed, not live finance KB grounding.
- Fixture runs must be labeled as fixture runs in JSONL and run notes.

## Request

The future retrieval call should include:

- `chatbotId`: stable chatbot identifier.
- `participantId`: stable participant identifier when available.
- `courseId`: stable course identifier when available.
- `selectedMode`: expected to be `tutor` for tutor runs.
- `query`: retrieval query derived from the current student turn.
- `topK`: requested maximum evidence count.
- `caseId`: optional TutorBench case identifier for eval runs only.

## Response

Each response should include:

- `traceId`: stable ID for correlating chat-api, MCP, and retrieval logs.
- `backend`: `fixture`, `lightrag`, `milvus`, or another concrete backend name.
- `status`: `ok`, `no_results`, `weak_results`, `unauthorized`, `timeout`, or
  `malformed_response`.
- `evidence`: ordered list of retrieved items.

Each evidence item should include:

- `evidenceId`: stable chunk or knowledge-graph evidence ID.
- `sourceTitle`: lecture, document, slide, or course source label.
- `sourceUri`: optional stable URI or internal source reference.
- `chunkId`: Milvus or source chunk ID when available.
- `conceptIds`: optional LightRAG concept/entity IDs.
- `citationLabel`: short label the tutor may cite.
- `snippet`: concise retrieved text used by the tutor.
- `score`: optional retrieval score.
- `canSendToModel`: whether this evidence may be sent to the selected model.

## Eval Recording

TutorBench result rows should record:

- `retrievalTraceStatus`: `inline`, `fixture`, `real`, or `unavailable`.
- `retrievalTraceId`: retrieval trace ID when available.
- `retrievalBackend`: concrete backend name.
- `retrievedEvidenceIds`: ordered evidence IDs.
- `retrievedCitationLabels`: ordered citation labels.
- `expectedRetrievalKeywordCoverage`: deterministic keyword coverage score.
- `expectedCitationKeywordCoverage`: deterministic citation coverage score.

## Fixture Scope

The first fixture pack should cover:

- WACC: weights, debt, equity, after-tax cost of debt.
- CAPM beta: risk-free rate, market risk premium, beta as excess-return
  sensitivity.
- Bond price/yield: inverse price-yield relation and duration intuition.

Fixture data must be clearly synthetic or course-sanitized. It should not be
presented as a live LightRAG/Milvus result.

## Handoff Checklist

Before switching fixture mode to real mode, the retrieval integration owner
should provide:

- reachable endpoint or MCP server configuration;
- auth/header requirements, including chatbot/course scoping;
- one successful request/response example for each finance case;
- trace IDs that appear in service logs;
- privacy/egress confirmation for sending retrieved snippets to the selected
  model;
- stable chatbot, participant, and course IDs for a smoke run;
- expected failure behavior for no-result and unauthorized cases.
