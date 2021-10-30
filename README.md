# klicker-uzh &middot;

`klicker-uzh` is the code repository of the [KlickerUZH](https://www.klicker.uzh.ch/) instant-class-response system.

The KlickerUZH consists of two main services (see [Architecture](https://www.klicker.uzh.ch/docs/deployment/deployment_architecture)), as well as an additional Shibboleth service for integration with SwitchAAI:

- [Frontend](https://github.com/uzh-bf/klicker-uzh/tree/dev/frontend) (subfolder)
- [Backend](https://github.com/uzh-bf/klicker-uzh/tree/dev/backend) (subfolder)
- [Shibboleth](https://github.com/uzh-bf/klicker-uzh/tree/dev/shibboleth) (subfolder)

The following additional resources might be of interest to you:

- [Documentation](https://www.klicker.uzh.ch/docs/introduction/getting_started)
- [Frequently Asked Questions](https://www.klicker.uzh.ch/docs/faq/faq)
- [Community and Discussions](https://github.com/uzh-bf/klicker-uzh/discussions)

## Roadmap / Issues

The KlickerUZH project is publicly managed and documented in this repository. A corresponding roadmap of our current developments can be found on our [Homepage](https://www.klicker.uzh.ch/roadmap). Please feel free to add any issues or feature requests you might have to the [Github Issues](https://github.com/orgs/uzh-bf/projects/4), or start a new discussion on [Github Discussions](https://github.com/uzh-bf/klicker-uzh/discussions).

## Deployment

If you would like to deploy an instance of the KlickerUZH at your institution, please have a look at the corresponding documentation with regards to the [Architecture](https://www.klicker.uzh.ch/docs/deployment/deployment_architecture), [Requirements](https://www.klicker.uzh.ch/docs/deployment/deployment_requirements), and further [Instructions](https://www.klicker.uzh.ch/docs/deployment/deployment_docker).

We also provide a set of examples and resources for Docker-based deployments. The `deploy` directory contains examples for Docker Compose deployments, as well as a Helm chart for a Kubernetes deployment (recommended for production).

## Contributing

We welcome any contributions to the KlickerUZH project. Before considering any contribution, we recommend that you create a discussion to discuss your proposed addition with the project maintainers and other contributors. Please also make sure to follow our [Contributing Guidelines](https://www.klicker.uzh.ch/docs/contributing/contributing_guidelines), as your PR might need amendments otherwise.

## License

The KlickerUZH and all of its subprojects are licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.de.html).
