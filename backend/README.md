# backend &middot;

This folder contains the GraphQL API backend of the [KlickerUZH](https://www.klicker.uzh.ch/) instant-class-response system.

### Requirements

To develop on the KlickerUZH, NodeJS 10.x LTS and Docker 18.0x or later are required. Additionally, the `frontend` service needs to be running and correctly configured on your machine. The dependencies can be installed by simply running `npm install` with NPM 6+. Please refer to [Development Setup](https://www.klicker.uzh.ch/docs/contributing/contributing_setup) for more detailed information on the development setup.

### Repository Structure

The `backend` repository is composed of the following key parts:

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
