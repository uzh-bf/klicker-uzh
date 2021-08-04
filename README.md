# klicker-react &middot; [![Build Status](https://travis-ci.org/uzh-bf/klicker-react.svg?branch=master)](https://travis-ci.org/uzh-bf/klicker-react) [![Maintainability](https://api.codeclimate.com/v1/badges/e6145f91794546ed622c/maintainability)](https://codeclimate.com/github/uzh-bf/klicker-react/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/e6145f91794546ed622c/test_coverage)](https://codeclimate.com/github/uzh-bf/klicker-react/test_coverage) [![codebeat badge](https://codebeat.co/badges/96559a8d-92aa-46c0-88ff-01c9035c0005)](https://codebeat.co/projects/github-com-uzh-bf-klicker-react-master)

`klicker-react` is the frontend component of the [KlickerUZH](https://www.klicker.uzh.ch/) instant-class-response system.

The KlickerUZH consists of two main services (see [Architecture](https://uzh-bf.github.io/klicker-uzh/docs/deployment/deployment_architecture)):

- [klicker-react](https://github.com/uzh-bf/klicker-react) (this repository)
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

To develop on the KlickerUZH, NodeJS 10.x LTS and Docker 18.0x or later are required. Additionally, the `klicker-api` service needs to be running and correctly configured on your machine. The dependencies can be installed by simply running `npm install` with NPM 6+. Please refer to [Development Setup](https://uzh-bf.github.io/klicker-uzh/docs/contributing/contributing_setup) for more detailed information on the development setup.

### Repository Structure

The `klicker-react` repository is composed of the following key parts:

- **src/** - main project sources

  - **src/pages/** - next.js pages (with implicit routes)
  - **src/components/** - react components for usage in pages
  - **src/graphql/** - graphql query and mutation definitions
    - **src/graphql/schema.graphql** - graphql schema
  - **src/lib/** - reusable libraries and functions
    - **src/lib/semantic/** - customized semantic ui library
  - **src/lang/** - translation files
  - **src/klicker.conf.js** - the configuration schema and defaults
  - **src/next.config.js** - the next.js configuration

- **server.js** - next.js server; application entrypoint
- **Dockerfile**
- **package.json**

## License

Klicker and all of its subprojects are licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.de.html).
