---
title: Getting Started
---

KlickerUZH is a web application that supports the interaction between speakers and their audience in various ways. During a Klicker session (e.g., a lecture), a speaker may pose questions to be answered by participants over their devices. If so desired by the speaker, the audience may ask questions to which the lecturer can leave a response from within the tool (Q&A). Next to the well-known speaker-to-audience interaction, this enables interactions initiated by the audience, which can serve as a useful orientation to the lecturer.

KlickerUZH is developed by the Teaching Center of the Department of Banking and Finance at the University of Zurich, Switzerland. The development and planning roadmap are entirely open-source, allowing for further extensibility and collabiration. This documentation is thought to provide both a helpful guide to users of the KlickerUZH, as well as the necessary information for anyone thinking about contributing to the project or deploying it on their own infrastructure.

## User Guide

To learn how to use the KlickerUZH efficiently, we recommend you read and follow the basic and advanced tutorials. These tutorials have been created to guide you through the entire application by means of an exemplary workflow. As an additional help to understand the workflow, the core concepts of the application are summarized in [Core Concepts](introduction/concepts.md).

In case of any questions, please have a look if your problem has already been described in the [FAQ](faq/faq.md). For further support, please feel free to contact our team as described below.

## Deployment

Instead of using the publicly hosted and freely accessible version of the application (the official "KlickerUZH"), it is also possible to host an instance on private infrastructure. This can be useful if an institution prefers to host their questions and results on private infrastructure only (e.g., if the question contents are sensitive, or the votes are confidential). The only thing to keep in mind is that we kindly ask (as reinforced by the license) that any extensions of self-hosted instances be provided back to the open-source project (as is good open-source spirit).

To deploy a private Klicker instance, we strongly recommend that you first familiarize yourself with the architecture of the application (see [Architecture Overview](deployment/architecture.md)). The remainder of the chapter on deployment will then lead you through the steps necessary to deploy the application yourself.

## Contributing

In the spirit of open source, we welcome any good-spirited contributions to the KlickerUZH (be it from institutions or individuals). To help in getting an overview of the entire application structure, we have put together some information about the [Application Architecture](deployment/architecture.md).

It is generally a good idea to first get an orientation about the general direction of the project from the [Roadmap](https://www.klicker.uzh.ch/development), as contributions should not be completely orthogonal or lead to duplicate work. Please feel free to create an issue or discussion on the [klicker-uzh](https://github.com/uzh-bf/klicker-uzh) project if you are unsure about your idea or regarding how to continue.

Additionally, in order to reduce the time spent on reviewing and refactoring code (on our side as well as yours), we put some [Contributing Guidelines](contributing/guidelines.md) in place that must be followed for a contribution to be accepted (describing things like code style and testing).

## Support & Community

We offer support for the KlickerUZH on various channels:

- Github Issues on [uzh-bf/klicker-uzh](https://github.com/uzh-bf/klicker-uzh/issues)
- Github Discussions on [uzh-bf/klicker-uzh](https://github.com/uzh-bf/klicker-uzh/discussions)
- Users of our [public instance](https://app.klicker.uzh.ch) can also email us at [klicker.support@uzh.ch](mailto:klicker.support@uzh.ch)

If you are affiliated with our organization, the University of Zurich, we would also like to invite you to join our public team on [Microsoft Teams](https://teams.microsoft.com/l/team/19%3afbf6198f94934e20ab86571dd73e8616%40thread.tacv2/conversations?groupId=1a1e9be8-effe-4e7d-98bd-d4a3c836c478&tenantId=c7e438db-e462-4c22-a90a-c358b16980b3), where you can talk to us and fellow users of the KlickerUZH.

Please bear in mind that even though we strive for good response time and general support, we do not have any dedicated support staff for the project. This is due to the fact that the project does not generate any monetary inflow, and its operations are funded by the Teaching Center, Department of Banking and Finance, and our university.
