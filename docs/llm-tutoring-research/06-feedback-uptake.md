# 06. Feedback Uptake and Learning Outcome Measurement

Scite status: unavailable in this environment. I used arXiv, DOI landing pages, and official sources instead.

## Core claim

For AI tutors, feedback quality is only half the story. The other half is whether students actually use the feedback, revise the work, and improve on the next attempt or on a later transfer task. A tutor can produce well-formed feedback and still fail if the student ignores it, cannot map it onto the answer, or only gets a short-lived gain.

## What to measure

The measurement stack should separate four things:

1. Reach: did the student see the feedback?
2. Uptake: did the student do something with it?
3. Correction: did the next attempt actually address the issue?
4. Learning: did performance improve on later items, delayed tests, or transfer tasks?

Suggested metrics:

| Metric | Definition | Why it matters |
| --- | --- | --- |
| `feedback_view_rate` | feedback shown / feedback delivered | basic exposure signal |
| `feedback_open_rate` | opened or expanded / shown | stronger than delivery |
| `time_to_first_action_ms` | first edit, hint click, or resubmit after feedback | responsiveness proxy |
| `uptake_rate` | any relevant action after feedback / feedback delivered | coarse behavioral uptake |
| `corrected_uptake_rate` | feedback-following action that fixes the tagged issue | best near-term proxy |
| `next_attempt_accuracy` | correctness on the next submission after feedback | direct local outcome |
| `revision_quality_delta` | post-revision rubric score minus pre-revision score | better for open-ended work |
| `attempts_to_mastery` | attempts until correct or mastery threshold | captures efficiency |
| `delayed_gain` | delayed post-test minus pre-test | retention / transfer signal |

## How to operationalize uptake

Use feedback tags that describe the intended student action, not only the pedagogical quality of the message. Examples:

- `action:fix_sign_error`
- `action:recheck_definition`
- `action:add_example`
- `action:justify_step`
- `action:compare_against_rubric`

Then score uptake by comparing the tag to the next student edit or resubmission. For open-ended answers, a human rubric or a separate automatic classifier can mark whether the edit actually addressed the tagged issue.

Useful distinctions:

- `viewed_but_not_acted`
- `acted_but_not_correctly`
- `acted_and_corrected`
- `ignored_after_view`
- `abandoned_after_feedback`

That lets you avoid the common trap of treating clicks or dwell time as learning.

## Learning outcome measurement

Use at least one immediate measure and one delayed measure. Immediate tests catch short-term correction; delayed tests capture retention and transfer. The current tutoring literature also suggests that immediate measurement can overstate effect sizes, so delayed tests should not be optional.

Recommended outcome stack:

- Local post-test aligned to the exercise skill
- Delayed post-test, ideally 1 to 2 weeks later
- Transfer items with new surface forms
- Course assessment or exam performance where available
- Knowledge-component mastery change, if Klicker has a skill model

If you only use course grade or overall quiz score, you will miss whether the tutor improved the specific misconception it was supposed to address.

## Experimental designs that actually answer the question

- Randomize at the student or question level when possible.
- Use cluster randomization by section or assignment only when contamination is likely.
- For feedback variants, run a factorial design around specificity, timing, and explanation depth.
- Pre-register a primary outcome: next-attempt correctness, revision quality, or delayed gain.
- Analyze with mixed-effects models so question difficulty and student baseline skill do not dominate the result.

Best practice is to measure both local and delayed outcomes, because a tutor can look strong on immediate repair while doing little for retention.

## Privacy-aware logging

Learning analytics data is sensitive. Students’ privacy concerns in learning analytics are real, and a privacy framework should be part of the logging design, not an afterthought.

Practical rules:

- Log pseudonymous user IDs, not direct identifiers.
- Log event metadata by default, not raw tutor text or raw student text.
- Keep raw text only when you need it for short-lived QA or manual annotation.
- Strip or hash content fields that are not needed for evaluation.
- Version prompts, rubric tags, and tutor model IDs so you can compare runs without storing extra content.
- Retain only the minimum data needed for the research window.
- Consider differential privacy for aggregate dashboards.

## Klicker event schema

A compact schema that supports uptake and learning analysis:

```json
{
  "event_id": "uuid",
  "occurred_at": "2026-06-17T12:34:56.000Z",
  "course_id": "course_123",
  "activity_id": "quiz_7",
  "question_id": "q_4",
  "attempt_id": "att_9",
  "student_pid": "hashed-pseudonymous-id",
  "feedback_id": "fb_17",
  "feedback_version": "v3",
  "model_name": "gpt-4.1",
  "prompt_version": "prompt_12",
  "feedback_kind": "hint",
  "feedback_tag": "action:fix_sign_error",
  "event_type": "feedback_viewed",
  "action_type": "expanded",
  "latency_ms": 8421,
  "content_hash": "sha256:...",
  "pii_redacted": true
}
```

Recommended event types:

- `feedback_delivered`
- `feedback_viewed`
- `feedback_expanded`
- `feedback_dismissed`
- `feedback_clicked`
- `student_revision_started`
- `student_revision_saved`
- `student_submission_received`
- `answer_regraded`
- `post_test_completed`
- `delayed_test_completed`

If Klicker wants a smaller first pass, keep just `feedback_delivered`, `feedback_viewed`, `student_submission_received`, `answer_regraded`, and `post_test_completed`, then add the richer events later.

## Source URLs

- Hattie and Timperley, *The Power of Feedback* (2007): https://doi.org/10.3102/003465430298487
- Shute, *Focus on Formative Feedback* (2008): https://doi.org/10.3102/0034654307313795
- Kochmar et al., *Automated Personalized Feedback Improves Learning Gains in an Intelligent Tutoring System* (2020): https://arxiv.org/abs/2005.02431
- Grenander et al., *Deep Discourse Analysis for Generating Personalized Feedback in Intelligent Tutor Systems* (2021): https://arxiv.org/abs/2103.07785
- Pardos and Bhandari, *Learning gain differences between ChatGPT and human tutor generated algebra hints* (2023): https://arxiv.org/abs/2302.06871
- Yadav et al., *Beyond Repetition: The Role of Varied Questioning and Feedback in Knowledge Generalization* (2024): https://arxiv.org/abs/2405.09655
- Olney et al., *Efficacy of a Computer Tutor that Models Expert Human Tutors* (2025): https://arxiv.org/abs/2504.16132
- Niousha et al., *The Missing Evaluation Axis: What 10,000 Student Submissions Reveal About AI Tutor Effectiveness* (2026): https://arxiv.org/abs/2605.05648
- Mutimukwe et al., *Students' Information Privacy Concerns in Learning Analytics* (2021): https://arxiv.org/abs/2109.00068
- Liu et al., *Advancing privacy in learning analytics using differential privacy* (2025): https://arxiv.org/abs/2501.01786
- NIST Privacy Framework: https://www.nist.gov/privacy-framework
