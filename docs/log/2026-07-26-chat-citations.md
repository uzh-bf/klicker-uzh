## 2026-07-26

- **Update**: [chat-platform](../chat-platform.md) documents the citation-chip wrap contract
  (pre-marker space stripping in `splitCitationMarkers` plus a U+2060 word joiner in
  `CitationChip` — both needed, per UAX #14), the `auto-fit` source-card grid with its
  `min(230px, 100%)` overflow floor, the static `messagesByLocale` map the root layout must
  reuse (Turbopack cannot resolve dynamic bare-subpath imports), and the unconditional
  server-side Swiss High German orthography contract (`withLanguageStyleContract`) that
  survives lecturer-stored prompts replacing `DEFAULT_PROMPT`.

- **Update**: [chat-platform](../chat-platform.md) documents the per-type locator line under a
  source's name (`getSourceSecondaryLine`): documents lead with the page, web links with a
  cleaned display URL, videos with a `12:34`-style position — and records that doc_query has no
  timestamp field, so video positions can only come from a clock-valued `labeled_page_number`
  or a `t`/`start`/`#t=` URL parameter until the doc-query service grows a dedicated field.

- **Update**: [chat-platform](../chat-platform.md) gains a "Sources and citations" section —
  how the source list is derived from a message's own `doc_query` tool-call parts, the tool-name
  forms the gate has to tolerate, the numbering rules the rendered cards and the server-side
  prompt contract must agree on, and the parsed-payload gate behind the "no results" copy. The
  Testing section describes the new end-to-end block and how it seeds the MCP result envelope.

- **Creation**: [ADR 0004](../adr/0004-chat-citations-from-tool-call-parts.md) records why
  citations are derived client-side from persisted tool-call parts instead of a new persisted
  field, so live streaming and reloaded history render from the same source.
