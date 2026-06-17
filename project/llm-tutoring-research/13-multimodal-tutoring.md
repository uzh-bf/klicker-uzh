# 13. Multimodal Tutoring for Diagrams, Handwriting, Screenshots, Tables, and Finance Charts

Scite status: unavailable in this environment. I used arXiv, benchmark/project pages, and official repository sources instead.

## Core claim

For tutoring, multimodal input is not a nice-to-have. It is the way students actually submit evidence: handwritten work, diagrams, screenshots of worked steps, tables, and chart images. The problem is that current multimodal models are weakest exactly where tutoring needs them most: fine-grained perception, OCR, layout, and cross-element reasoning.

That means the first Klicker version should treat image description as a structured extraction problem, not a generic captioning problem. The description has to preserve the parts that matter for feedback, correction, and grading.

## What the benchmarks say

### Broad multimodal reasoning

- MMMU is the clearest reminder that general multimodal reasoning is still hard. It mixes many disciplines and image types, including charts, diagrams, tables, maps, and chemical structures. The benchmark reports substantial gaps even for strong proprietary models.
- MMMU-Pro is stricter. It removes items solvable from text alone, adds harder options, and includes a vision-only setting. Its results suggest that OCR prompts are not a silver bullet, while chain-of-thought style reasoning helps only modestly.
- MathVista focuses on mathematics in visual contexts. It is directly relevant for plotted functions, geometry, handwritten steps, and other visually encoded math. The benchmark still shows a large gap between strong models and human performance.
- HallusionBench is useful as a warning sign: models can answer with fluent text that conflicts with the image, especially when language priors are strong.

### OCR, handwriting, and document literacy

- OCRBench explicitly evaluates text recognition, document VQA, key information extraction, and handwritten mathematical expression recognition. Its takeaway is simple: multimodal models are still brittle on multilingual text, handwritten text, non-semantic text, and math expressions.
- CC-OCR expands the OCR view into more realistic document processing and finds persistent weaknesses in text grounding, multi-orientation text, and repetition hallucination.
- MathWriting is a good reminder that handwritten mathematical expressions deserve their own benchmark treatment. Handwriting is not just OCR with noise. The layout and symbol structure matter.
- DocVQA shows why documents are special: the structure of the page matters, and the gap to human performance is still large when that structure is important.

### Chart literacy and diagram interpretation

- ChartQA targets charts that require both visual reading and arithmetic or logical reasoning.
- ChartBench pushes further on complex visual reasoning in charts and shows that chart understanding is still fragile when charts are not neatly annotated.
- SCI-CQA is especially relevant for real tutoring use because scientific figures often mix plots, flowcharts, and structural diagrams. This is closer to the kind of screenshot-heavy, lecture-note-heavy input we see in practice.
- AI2D-RST is a useful diagram reference point because it treats diagrams as structured multimodal objects, not just flat images. That is the right mental model for tutoring on arrows, labels, callouts, and relationships.

## Failure modes that matter for tutoring

- Spatial relations get lost when an image is reduced to a plain caption.
- OCR mistakes break math, tables, and formulas first.
- Chart descriptions often miss axes, units, legends, approximate values, and which visual marks belong to which series.
- Handwritten work is brittle because a single misread symbol can flip the meaning of a proof step or algebra line.
- Multi-image prompts can drift across images and mix up object identity or attachment order.
- Hallucinated details are dangerous in tutoring because they are often written confidently enough to sound authoritative.

## Klicker implication

The current chat path in `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` converts uploaded images into textual descriptions and then injects those descriptions back into the model prompt as `[Attached image description: ...]` or numbered variants.

That makes the image-description layer a first-class product surface. If the description misses a superscript, axis label, arrow direction, or table header, the tutor cannot recover that detail later. For a first pass, the description should preserve:

- visible text as faithfully as possible
- math symbols, fractions, exponents, and equation layout
- table structure, headers, row labels, and totals
- chart axes, units, legend entries, trends, and approximate values
- diagram nodes, arrows, labels, and spatial relations
- uncertainty markers when the image is blurry or partially occluded

## Eval cases for Klicker image-description path

Use these as concrete checks against `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` and the attachment hydration tests in `apps/chat/test/`:

| Case | What to upload | Pass condition |
| --- | --- | --- |
| Handwritten math | Notebook photo with fractions, exponents, and crossed-out work | The description keeps the math structure and flags illegible symbols instead of inventing them |
| Diagram | Labeled biology, physics, or process diagram with arrows | The description names entities, arrows, and relationships in the correct layout order |
| Chart screenshot | Bar, line, or scatter chart with axes and legend | The description captures axes, units, series names, and trend direction without hallucinated values |
| Table screenshot | Dense spreadsheet or slide table | The description preserves headers, row/column associations, and any totals or footnotes |
| Finance chart | Candlestick or line chart with indicators | The description includes timeframe, price axis, indicators, overlays, and any annotation text |
| Multi-image upload | Two or more attached images in one message | Descriptions stay in attachment order and are injected as separate numbered entries |
| Description failure | Force the image-description step to fail | The request still completes with a safe fallback rather than crashing or dropping the attachment |

## Recommended research conclusion

The right MVP is not a general "vision tutor". It is a description-and-reasoning pipeline that is tested separately on diagrams, handwritten math, screenshots, tables, and charts. That keeps the first release honest about what the model can and cannot see, and it gives us a clean place to measure improvement later.

## Source URLs

- MMMU: https://arxiv.org/abs/2311.16502
- MMMU-Pro: https://arxiv.org/abs/2409.02813
- MathVista: https://arxiv.org/abs/2310.02255
- HallusionBench: https://arxiv.org/abs/2310.14566
- OCRBench: https://arxiv.org/abs/2305.07895
- CC-OCR: https://arxiv.org/abs/2412.02210
- MathWriting: https://arxiv.org/abs/2404.10690
- DocVQA: https://arxiv.org/abs/2007.00398
- ChartQA: https://arxiv.org/abs/2203.10244
- ChartBench: https://arxiv.org/abs/2312.15915
- SCI-CQA: https://arxiv.org/abs/2412.12150
- AI2D-RST: https://arxiv.org/abs/1912.03879
