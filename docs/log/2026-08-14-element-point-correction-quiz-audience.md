---
type: Change Log
title: Element point correction quiz audience
description: Add an element-only correction audience for every participant who answered anywhere in the quiz.
timestamp: '2026-08-14'
tags:
  - assessment
  - point-corrections
---

## 2026-08-14

- **Update:** Point corrections for one quiz element can now target all
  participants with at least one genuine response anywhere in the quiz, even if
  they did not answer the selected element. Whole-quiz corrections retain the
  original four audiences. See
  [assessment point corrections](../domain-model.md#assessment-point-corrections).

## Browser verification

Element corrections expose the fifth quiz-participant audience:

![Five audience options for an element correction](../images/2026-08-14-element-point-correction/element-audience-options.png)

Whole-quiz corrections retain the original four audiences:

![Four audience options for a whole-quiz correction](../images/2026-08-14-element-point-correction/quiz-audience-options.png)
