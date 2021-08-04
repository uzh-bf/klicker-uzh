# klicker-api &middot; [![Build Status](https://travis-ci.org/uzh-bf/klicker-api.svg?branch=master)](https://travis-ci.org/uzh-bf/klicker-api) [![Maintainability](https://api.codeclimate.com/v1/badges/63d250693c832c79534d/maintainability)](https://codeclimate.com/github/uzh-bf/klicker-api/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/63d250693c832c79534d/test_coverage)](https://codeclimate.com/github/uzh-bf/klicker-api/test_coverage) [![codebeat badge](https://codebeat.co/badges/a046180d-af09-4d35-8d56-52eeeb3502be)](https://codebeat.co/projects/github-com-uzh-bf-klicker-api-master)

`klicker-api` is the GraphQL API backend of the [KlickerUZH](https://www.klicker.uzh.ch/) instant-class-response system.

The KlickerUZH consists of two main services (see [Architecture](https://uzh-bf.github.io/klicker-uzh/docs/deployment/deployment_architecture)):

- [klicker-react](https://github.com/uzh-bf/klicker-react)
- [klicker-api](https://github.com/uzh-bf/klicker-api)

The following additional resources might be of interest to you:

- [Documentation](https://uzh-bf.github.io/klicker-uzh/docs/introduction/getting_started)
- [Frequently Asked Questions (FAQ)](https://uzh-bf.github.io/klicker-uzh/docs/faq/faq)
- [Spectrum Community](https://spectrum.chat/klickeruzh)

## Roadmap / Issues

The KlickerUZH project is publicly managed and documented in the [klicker-uzh](https://github.com/uzh-bf/klicker-uzh) repository. A roadmap can be found at https://github.com/uzh-bf/klicker-uzh/projects/1. Please feel free to add any issues and comments you might have to that repository.

## Deployment

If you would like to deploy an instance of the KlickerUZH at your institution, please have a look at the corresponding documentation with regards to the [Architecture](https://uzh-bf.github.io/klicker-uzh/docs/deployment/deployment_architecture), [Requirements](https://uzh-bf.github.io/klicker-uzh/docs/deployment/deployment_requirements), and further [Instructions](https://uzh-bf.github.io/klicker-uzh/docs/deployment/deployment_docker).

## Contributing

We welcome any contributions to the KlickerUZH project. Before considering any contribution, we recommend that you create an issue to discuss your proposed addition with the project contributors. Please also make sure to follow our [Contributing Guidelines](https://uzh-bf.github.io/klicker-uzh/docs/contributing/contributing_guidelines), as your PR might need amendments otherwise.

### Requirements

To develop on the KlickerUZH, NodeJS 10.x LTS and Docker 18.0x or later are required. Additionally, the `klicker-react` service needs to be running and correctly configured on your machine. The dependencies can be installed by simply running `npm install` with NPM 6+. Please refer to [Development Setup](https://uzh-bf.github.io/klicker-uzh/docs/contributing/contributing_setup) for more detailed information on the development setup.

### Repository Structure

The `klicker-api` repository is composed of the following key parts:

- **src/** - main project sources

  - **src/integration/** - integration tests (graphql)
  - **src/models/** - mongoose data models
  - **src/services/** - application business logic
  - **src/types/** - graphql type definitions
  - **src/resolvers/** - graphql resolvers
  - **src/lib/** - reusable libraries and functions
  - **src/app.js** - the main server logic
  - **src/server.js** - application entrypoint
  - **src/schema.js** - graphql schema
  - **src/redis.js** - redis connection procedures
  - **src/klicker.conf.js** - the configuration schema and defaults

- **Dockerfile**
- **package.json**

## License

Klicker and all of its subprojects are licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.de.html).
