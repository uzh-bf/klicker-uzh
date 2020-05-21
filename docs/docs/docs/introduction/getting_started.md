---
id: getting_started
title: Getting Started
sidebar_label: Getting Started
---

Klicker UZH is a web application that supports the interaction between speakers and their audience in various ways. During a Klicker session (e.g., a lecture), a speaker may pose questions to be answered by participants over their devices. If so desired by the speaker, the audience may also rate the speed and difficulty of the session and provide open feedback. Next to the well-known speaker-to-audience interaction, this enables interactions initiated by the audience, which can serve as a useful orientation to the lecturer.

Klicker UZH was developed by the Teaching Center of the Department of Banking and Finance at the University of Zurich, Switzerland. The preceding version had been in heavy use for many years (both in- and outside of our University), and the foundations had gotten heavily outdated. The relaunched Klicker UZH 2.0 is built on a state-of-the-art foundation and adds many requested features and functionalities. The planning and development are entirely open-source, allowing for further extensibility.

This documentation is thought to provide both a helpful guide to users of the Klicker UZH, as well as the necessary information for anyone thinking about contributing to the project or deploying it themselves.

## User Guide

To learn how to use the Klicker UZH efficiently, we recommend you read and follow the basic and advanced tutorials. These tutorials have been created to guide you through the entire application by means of an exemplary workflow. As an additional help to understand the workflow, the core concepts of the application are summarized in [Core Concepts](introduction/concepts.md).

In case of any questions, please have a look if your problem has already been described in either the FAQ or Troubleshooting sections. For any further support, please feel free to contact our team as described below.

## Deployment

Instead of using the publicly hosted version of the application (the official "Klicker UZH"), it is also possible to host an instance on private infrastructure. This can be useful if an institution prefers to host their questions on private infrastructure only (e.g., if the question contents are sensitive). The only thing to keep in mind is that we kindly ask (as reinforced by the license) that any extensions of self-hosted instances be provided back to the open-source project (as is good open-source spirit).

To deploy a private Klicker instance, we strongly recommend that you first familiarize yourself with the architecture of the application (see [Architecture Overview](deployment/architecture.md)). The remainder of the chapter on deployment will then lead you through the steps necessary to deploy the application yourself.

## Contributing

In the spirit of open source, we welcome any good-spirited contributions to the Klicker UZH (be it from institutions or individuals). To help in getting an overview of the entire application structure, we have put together some information about the [Application Architecture](deployment/architecture.md) as well as an overview of the different Repositories in the project and their respective uses.

It is generally a good idea to first get an orientation about the general direction of the project from the [Roadmap](https://github.com/uzh-bf/klicker-uzh/projects/1), as contributions should not be completely orthogonal or lead to duplicate work. Please feel free to create an issue on the `klicker-uzh` project if you are unsure about any specifics.

Additionally, in order to reduce the time spent on reviewing and refactoring code (on our side as well as yours), we put some [Contributing Guidelines](contributing/guidelines.md) in place that must be followed for a contribution to be accepted (describing things like code style and testing).

## Support & Community

We offer support for the Klicker UZH on various channels:

- Webchat as included in the application
- Email on [klicker.support@uzh.ch](mailto:klicker.support@uzh.ch)
- Spectrum Community on [spectrum.chat/klickeruzh](https://spectrum.chat/klickeruzh)

Please bear in mind that even though we strive for good response time and general support, we do not have any dedicated support staff for the project. This is due to the fact that the project does not generate any monetary inflow, and its operations are funded only by the Department of Banking and Finance and UZH.
