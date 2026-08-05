# Log

The wiki change log lives in [log/](./log/) — **one file per change batch**,
named `YYYY-MM-DD-<slug>.md` (date of the newest entry, short kebab-case
topic). Sort filenames descending to read the log newest-first.

A new change always gets a **new file**; never append to this file, another
batch's file, or the frozen [archive](./log/archive.md). Per-file format is
unchanged: `## YYYY-MM-DD` headings with `**Creation**`/`**Update**`/
`**Deprecation**` bullets linking the touched pages.

This file exists only to explain the convention — single-file append logs
conflict on every concurrently open branch.
