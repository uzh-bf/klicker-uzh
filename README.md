- `.env` files in `packages/graphql` und `apps/backend-sls`
- `local.settings.json` in `apps/backend-sls`
- install Azure Functions Core Tools
  - https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local?tabs=v4%2Clinux%2Ccsharp%2Cportal%2Cbash
  - https://github.com/Azure/azure-functions-core-tools/blob/v4.x/README.md#other-linux-distributions
- Download Postman https://www.postman.com/downloads/ to test API requests

### Get Things Running

- Run `npm install` on the top level of the repository to install all required dependencies (including prisma, etc.)
- Switch to `packages/prisma` and run `npm run generate` and `npm run build`
- Switch to `packages/graphql` and run `npm run generate` and `npm run build`
- Switch to the app you are working on and run `npm install` and `npm run dev`

![Klicker Logo](https://www.klicker.uzh.ch/img/KlickerUZH_Gray_Transparent.png)

`klicker-uzh` is the code repository of the [KlickerUZH](https://www.klicker.uzh.ch/) instant-class-response system. KlickerUZH is developed by the Teaching Center of the Department of Banking and Finance at the University of Zurich, Switzerland.

![Klicker Timeline](https://www.klicker.uzh.ch/img/timeline_mac.png)

The KlickerUZH consists of two main services (see [Architecture](https://www.klicker.uzh.ch/deployment/deployment_architecture)), as well as an additional Shibboleth service for integration with [SwitchAAI](https://www.switch.ch/aai/):

- [Frontend](https://github.com/uzh-bf/klicker-uzh/tree/dev/apps/frontend) (subfolder)
- [Backend](https://github.com/uzh-bf/klicker-uzh/tree/dev/apps/backend) (subfolder)
- [Shibboleth](https://github.com/uzh-bf/klicker-uzh/tree/dev/shibboleth) (subfolder)

In addition to key application components, this repository also includes the codebases for our landing page (www.klicker.uzh.ch) and documentation (www.klicker.uzh.ch/docs), as well as deployment scripts and examples:

- [Docs](https://github.com/uzh-bf/klicker-uzh/tree/dev/apps/docs) (subfolder)
- [Deployment](https://github.com/uzh-bf/klicker-uzh/tree/dev/deploy) (subfolder)

## Roadmap / Issues

The KlickerUZH project is publicly managed and documented in this repository. A corresponding roadmap of our current developments can be found on our [Homepage](https://www.klicker.uzh.ch/development). Please feel free to add any issues or feature requests you might have to the [Roadmap](https://klicker-uzh.feedbear.com), or start a new discussion on [Github Discussions](https://github.com/uzh-bf/klicker-uzh/discussions).

## Further Resources

The following additional resources might be of interest to you:

- [Documentation](https://www.klicker.uzh.ch/introduction/getting_started)
- [Frequently Asked Questions](https://www.klicker.uzh.ch/faq)
- [Community and Discussions](https://www.klicker.uzh.ch/community)
- [Roadmap](https://klicker-uzh.feedbear.com)

## Deployment

If you would like to deploy an instance of the KlickerUZH at your institution, please have a look at the corresponding documentation with regards to the [Architecture](https://www.klicker.uzh.ch/deployment/deployment_architecture), [Requirements](https://www.klicker.uzh.ch/deployment/deployment_requirements), and further [Instructions](https://www.klicker.uzh.ch/deployment/deployment_docker).

We also provide a set of examples and resources for Docker-based deployments. The `deploy` directory contains examples for Docker Compose deployments, as well as a Helm chart for a Kubernetes deployment (recommended for production).

## Contributing

We welcome any contributions to the KlickerUZH project. Before considering any contribution, we recommend that you create a discussion to discuss your proposed addition with the project maintainers and other contributors. Please also make sure to follow our [Contributing Guidelines](https://www.klicker.uzh.ch/contributing/contributing_guidelines), as your PR might need amendments otherwise.

## License

The KlickerUZH and all of its subprojects are licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.de.html).
