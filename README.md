<img src="https://manage.klicker.uzh.ch/KlickerLogo.png" width="350">

`klicker-uzh` is the code repository of the [KlickerUZH](https://www.klicker.uzh.ch/) instant-class-response system. KlickerUZH is developed by the Teaching Center of the Department of Banking and Finance at the University of Zurich, Switzerland.

Please note that this is the repository branch for the new KlickerUZH version 3.0 with a beta launch scheduled before the spring semester 2023 and stable release for the autumn semester 2023. Please navigate to the [dev branch](https://github.com/uzh-bf/klicker-uzh/tree/dev) for the currently stable production code.

![Klicker Screenshot Timeline](https://www.klicker.uzh.ch/img/timeline_mac.png)

KlickerUZH v3.0 uses multiple different services that communicate with each other and will also include an additional Shibboleth service for integration with [SwitchAAI](https://www.switch.ch/aai/):

- [Frontend PWA](https://github.com/uzh-bf/klicker-uzh/tree/v2/apps/frontend-pwa) is the student frontend of KlickerUZH, which contains the student views for live sessions, micro-learnings, repetition elements, leaderboards and more. It runs on a separate domain [pwa.klicker.uzh.ch](https://pwa.klicker.uzh.ch/) and can be installed as a progressive web app.
- [Frontend Manage](https://github.com/uzh-bf/klicker-uzh/tree/v2/apps/frontend-manage) is the lecturer frontend of KlickerUZH, which provides all the functionalities that lecturers need, including but not limited to question management, session management, course management and analytics. It can be accessed at [manage.klicker.uzh.ch/login](https://manage.klicker.uzh.ch/login).
- [Backend Docker](https://github.com/uzh-bf/klicker-uzh/tree/v2/apps/backend-docker) is the main backend service of KlickerUZH.
- [Backend Responses](https://github.com/uzh-bf/klicker-uzh/tree/v2/apps/backend-responses) is a service that handles incoming student responses during a live session and puts them into an Azure queue for load handling reasons.
- [Backend Response Processor](https://github.com/uzh-bf/klicker-uzh/tree/v2/apps/backend-response-processor) accesses queued elements from the aforementioned service and processes them by computing scores, updating the cache, etc.

In addition to key application components, this repository also includes the codebases for our landing page (www.klicker.uzh.ch) and documentation (www.klicker.uzh.ch/docs), as well as deployment scripts and examples:

- [Docs](https://github.com/uzh-bf/klicker-uzh/tree/v2/apps/docs) (subfolder)
- [Deployment](https://github.com/uzh-bf/klicker-uzh/tree/v2/deploy) (subfolder)

To share code more easily between different services, we added new packages to the [Package Directory](https://github.com/uzh-bf/klicker-uzh/tree/v2/packages) with the following components:

- [Grading](https://github.com/uzh-bf/klicker-uzh/tree/v2/packages/grading): The grading package provides the grading logic that is used to assign scores to participants and groups in live sessions, learning elements, micro-sessions and other KlickerUZH elements.
- [Markdown](https://github.com/uzh-bf/klicker-uzh/tree/v2/packages/markdown): The markdown package exports a React component to render markdown strings into formatted elements.
- [Shared Components](https://github.com/uzh-bf/klicker-uzh/tree/v2/packages/shared-components): The `shared-components` package is configured as an internal turborepo package, mainly providing the possibility to share components between the two frontends and reduce code duplication.

For more code commonality between different projects at the Teaching Center and the Department of Banking and Finance more generally, we also introduced a [Design System Package](https://github.com/uzh-bf/design-system) with commonly used components.

## Roadmap / Issues

The KlickerUZH project is publicly managed and documented in this repository. A corresponding roadmap of our current developments can be found on our [Homepage](https://www.klicker.uzh.ch/development). Please feel free to add any issues or feature requests you might have to the [Roadmap](https://klicker-uzh.feedbear.com) or start a new discussion in our [Community](https://community.klicker.uzh.ch/).

## Further Resources

The following additional resources might be of interest to you:

- [Documentation](https://www.klicker.uzh.ch/introduction/getting_started)
- [Frequently Asked Questions](https://www.klicker.uzh.ch/faq)
- [Community and Discussions](https://www.klicker.uzh.ch/community)
- [Roadmap](https://klicker-uzh.feedbear.com)

## Deployment

This section is still work in progress as our architecture continues to experience minor changes. If you would like to deploy an instance of the currently stable version of KlickerUZH, please refer to the corresponding [Deployment Section](https://github.com/uzh-bf/klicker-uzh/tree/dev#deployment) on our `dev branch`.

## Contributing

We welcome any contributions to the KlickerUZH project. Before considering any contribution, we recommend that you create a discussion to discuss your proposed addition with the project maintainers and other contributors. Please also make sure to follow our [Contributing Guidelines](https://www.klicker.uzh.ch/contributing/contributing_guidelines), as your PR might need amendments otherwise.

## License

The KlickerUZH and all of its subprojects are licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.de.html).
