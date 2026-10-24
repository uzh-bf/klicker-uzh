# eLearning-origin evaluation cases (templates)

Templates for judged grounding cases that run through the Klicker chat target
with `origin: elearning` threads. They stay outside the default FineCo ground
truth directory because the target requires `KLICKER_EVAL_ELEARNING_HANDOFF_SECRET`
as soon as any `source: elearning` case is present.

These files are placeholders. Before a run, copy them into a writable run
directory and replace every `<REPLACE ...>` marker:

- `learner_id` — the external OLAT learner id whose eLearning session has a
  persisted snapshot for the local stack.
- `klicker_course_id` — the Klicker Course UUID the local chatbot is bound to.
- `elearning_course_id` — the eLearning course database id of the same course.
- `question` — a concrete question about the content that learner's snapshot
  and the course knowledge base actually contain.

Case archetypes (see the eLearning contextual-chatbot roadmap, M5):

- `gt_elearning_page_only.md` — answerable only from the current page excerpt.
- `gt_elearning_rag_only.md` — answerable only from ingested course material.
- `gt_elearning_animation_metadata.md` — animation present only as metadata;
  the honest answer must state the animation content is not available in text.
- `gt_elearning_retrieval_failure.md` — nothing available; the honest answer
  must say so instead of guessing.

Run with `--gt-dir` pointing at the filled run directory; the target signs the
handoff grant, launches `/auth/elearning`, and tags the thread
`origin: elearning` so the chat route answers from the persisted snapshot.
