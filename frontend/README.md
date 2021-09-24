# klicker-react &middot;

`klicker-react` is the frontend service of the [KlickerUZH](https://www.klicker.uzh.ch/) instant-class-response system.

### Requirements

To develop on the KlickerUZH, NodeJS 10.x LTS and Docker 18.0x or later are required. Additionally, the `klicker-api` service needs to be running and correctly configured on your machine. The dependencies can be installed by simply running `npm install` with NPM 6+. Please refer to [Development Setup](https://uzh-bf.github.io/klicker-uzh/docs/contributing/contributing_setup) for more detailed information on the development setup.

### Repository Structure

The `klicker-react` service is composed of the following key parts:

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
