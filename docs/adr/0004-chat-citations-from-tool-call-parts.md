# 4. Chat citations are derived from tool-call parts

Source cards and inline `[n]` citation chips in `apps/chat` are computed from the assistant
message's own persisted tool-call parts, by a normalizer over the doc_query result payload. There
is no `sources` column on `ChatMessage` and no sources field on the messages API.

The alternative was to have the chat route extract sources at stream-completion time and persist
them alongside the message. That buys a stable, queryable record and one parse instead of one per
render. It costs a migration, a second representation of the same facts that can drift from the
tool result it was derived from, and — the deciding factor — it would freeze the current
`doc_query` payload shape into the database. The RAG pipeline is external to this repo and its
response contract is still moving; a normalizer we can widen in one file is cheaper to correct
than persisted rows we would have to backfill.

The consequences to accept: sources cannot be queried or aggregated without re-parsing message
content, the normalizer must stay tolerant of malformed and partial payloads rather than trusting
a validated write path, and citation numbering is a render-time convention that the server-side
prompt contract has to mirror by hand instead of sharing a stored numbering.
