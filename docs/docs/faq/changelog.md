---
id: changelog
title: Release Notes
sidebar_label: Release Notes
---

## Upcoming - v1.7.0 (TBD)

## v1.6.0 (September 2021)

The latest release of the KlickerUZH marks the start of our P-8 project on Digital Skills supported by Swissuniversities and the University of Zurich. As part of this project, we will design, develop, and evaluate different functionalities and concepts that support interaction and collaboration in the classroom. We will regularly interact with users of the KlickerUZH to evaluate the concepts in real-world use cases, and to come up with best practice recommendations for publication.

This release includes the following large changes (among many smaller ones):

- Reimagined feedback channel (Q&A) that allows lecturers to interact with and respond to student feedbacks. This work was partially sponsored by our [faculty](https://www.oec.uzh.ch/de.html), which made possible many of the additional features like pinning and exporting feedbacks.
- Updated application architecture for deployment to a cloud like Microsoft Azure. The KlickerUZH will be hosted on Microsoft Azure starting with Fall 2021.
- Easier automated deployment with a configurable Helm chart that we will continuously improve to be more flexible.
- Restructuring of the KlickerUZH code base to a single source repository for simplified maintenance (https://github.com/uzh-bf/klicker-uzh) including all relevant [artifacts](https://github.com/orgs/uzh-bf/packages?repo_name=klicker-uzh), [discussions](https://github.com/uzh-bf/klicker-uzh/discussions), and a detailed [changelog](https://github.com/uzh-bf/klicker-uzh/blob/dev/CHANGELOG.md).

## v1.5.1 (September 2020)

The latest release of KlickerUZH has been developed during the spring semester 2020, as well as preceding the fall semester 2020. The following features have been added or improved:

- Creation of authenticated sessions with participant authentication using username/password or SWITCHaai (sponsored by the Faculty of Business, Economics, and Informatics at UZH).
- Display of feedbacks and confusion entries on the evaluation of past sessions
- Live counters for responses on the running session overview
- Fix: Issue with focus loss on question creation (i.e., being unable to add spaces in title or content)
- Miscellaneous small improvements

## v1.4.0 (January 2020)

With its latest release in January 2020, the KlickerUZH has been improved in a few critical areas:

- Rework of question management and session creation
  - It is now possible to create new questions even during session creation
  - Blocks during session creation can be reordered and removed
- Improvements in the editor for SC/MC questions
  - It is easier to reorder answering options in SC/MC questions (no more Drag and Drop)
  - Answering options are automatically saved on loss of focus, which means that the final option will not be lost anymore (if the question is saved without saving that option)
- Initial toast notifications provide more transparency on the success/failure of certain actions
  - If this feature is well-received, we might extend it to encompass further areas of the KlickerUZH
- Many other small usability changes thanks to the valuable feedback of [Prof. Chat Wacharamanotham](https://www.ifi.uzh.ch/en/zpac/people/chat.html)

## v1.3.0 (September 2019)

Preceding the fall semester of 2019, the KlickerUZH has been extended with many often asked for features:

- Easy login and registration with SWITCH AAI
- Export and import of questions
- Export of simple question statistics
- Export of evaluation results to CSV and PDF formats
- Executing sessions nonsequentially to continue past blocks and/or skip future blocks
- Setting countdowns for question blocks to automatically close them
- Resetting results of question blocks to restart polling
- Cancelling sessions (and later restarting them)

## v1.0.0 (August 2018)

In 2017 and 2018, KlickerUZH was built on a completely new infrastructure in order to able to work in a forward-looking and dynamic way. In terms of functionalities, users can expect the following enhancements:

- In addition to Single-Choice and Free-Text questions, Multiple-Choice questions are also available.
- You can show the solution for Single-Choice and Multiple-Choice questions.
- You can embed images within questions.
- You can visualize the audience results not only by bar or pie chart but also by stacked charts, word cloud, aggregated tables and histograms.
- The question management was improved by providing a question pool.
- You can use questions blocks and prepare the use of KlickerUZH better through the introduction of a session management.
- You can receive simple Instant Audience Feedback through Confusion Barometer and Feedback Channel in a very easy way.
- KlickerUZH is available in German and English and can easily be extended to other languages.
- The source code is open-source. This way you may run KlickerUZH at your own institutions and may contribute to the enhancement of KlickerUZH.
