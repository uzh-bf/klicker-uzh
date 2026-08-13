# Domain context

## Chatbot analysis capability

A reusable learning-analytics capability for examining educational chatbot use.
Its initial purposes are internal product-quality improvement and learning
analytics. Research is an additional purpose with separate eligibility and
governance requirements.

## Vorkurs pilot

The first application of the chatbot analysis capability to the mathematics
Vorkurs. It validates the generic concepts and reports without making the
capability specific to one course.

## Operational analysis

The first delivery stage. It produces trustworthy, privacy-aware usage and
conversation measures from the application's authoritative records.

## Telemetry enrichment

A later delivery stage that augments operational analysis with provider model,
cost, cache, latency, and tracing observations from their authoritative
telemetry systems.

## Analysis join

A purpose-bound association of facts read from their authoritative systems for
one analysis run. It records unmatched or ambiguous records and does not create
a new authoritative copy of provider calls.

## Source authority

The system responsible for a fact: PostgreSQL for chatbot conversations,
ratings, and analysis eligibility; LiteLLM for actual routed model, spend, and
cache usage; and Langfuse for trace and observation facts.

## Educational coding

A later delivery stage in which human-validated categories describe student
questions and tutoring responses. Automated classification or clustering may
support this stage only after the categories have been validated. This stage is
capacity-gated and is not part of the first implementation.

## Descriptive learning analytics

Measures that report observable interaction structure and recorded signals
without claiming to identify misconceptions, mastery, tutor quality, or learning
gain. These measures form the first learning-analytics delivery.

## Exchange

A student message linked to its tutor response. It is the primary unit for the
first descriptive analysis; the surrounding conversation supplies context.

## Exploratory semantic signal

An auditable rule-based indicator or unsupervised grouping derived from message
content. It can support discovery and sampling, but is not a validated measure
of tutoring quality, misconception, mastery, or learning.

## Learning episode

A sequence of exchanges concerning a coherent learning goal or difficulty.
Automatic episode boundaries are deferred until a suitable method has been
validated.

## Restricted content analysis

Analysis that may examine message text and stored image descriptions within a
controlled environment. It excludes model reasoning payloads, raw image bytes,
and raw tool results.

## Analysis artifact

An output derived from chatbot records for product-quality, learning-analytics,
or approved research purposes. Its permitted audience and lifetime depend on
whether it contains row-level or aggregate information.

## Analysis eligibility

The purpose-specific permission for a person's chatbot records to enter an
analysis dataset. Learning-analytics eligibility and research eligibility are
separate and may change over time. The analysis capability consumes these
eligibility decisions from the system that owns them; it does not define how
they are collected.

## Durable analysis dataset

A purpose-bound collection of eligible chatbot records and derived labels kept
for longitudinal learning analytics or approved research. It remains personal
data while a person can be identified, including through pseudonymous keys.

## Purpose-and-course pseudonym

A stable pseudonymous identity usable only within one analysis purpose and one
course instance. It supports longitudinal analysis inside that boundary without
enabling cross-purpose or cross-course linkage by default.

## Personal-data export

An artifact containing row-level records, free text, stable pseudonyms, or other
information relating to an identifiable person. It is created only through an
explicit restricted-export action for named operators, never as a general
download, and requires purpose eligibility plus restricted access.

## Eligibility withdrawal

A person's removal of learning-analytics or research eligibility. Future
processing for that purpose stops, and rebuildable row-level records and derived
data for that person are removed. Only outputs shown to be genuinely anonymous
may remain.

## Prospective eligibility

Records enter a purpose-bound analysis dataset only while the corresponding
eligibility is active. A later opt-in does not make earlier records eligible
unless the separate consent design explicitly authorizes retrospective use.

## Aggregate report

The default human-readable and machine-readable analysis output. It contains no
row-level conversation content. Values for groups smaller than five are hidden,
with complementary suppression across dimension tables and additive summary
partitions where totals or sibling fields would otherwise reveal them.

## Restricted export

An explicit, audited export of eligible row-level records for a named operator
and declared purpose. Content-bearing XLSX or JSONL files are never produced by
the default report path.

## Eligibility-ready analysis

Analysis that fails closed when authoritative, effective-dated eligibility is
unavailable. Before that integration exists, the capability may be developed
and verified only with synthetic fixtures.

## Rating coverage

The share of eligible tutor responses that have an explicit UP or DOWN rating.
Rating distributions are interpreted together with this coverage; unrated
responses are not treated as neutral or representative feedback.

## Exploratory cluster

An unsupervised grouping used to discover patterns and guide sampling. Default
reports may show disclosure-controlled size, coverage, and stability measures,
but example text and exchange assignments belong only in restricted exports.
