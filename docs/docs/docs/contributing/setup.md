---
id: contributing_setup
title: Development Setup
---

To develop on the KlickerUZH, your development environment needs to be setup correctly. This guide will shortly walk you through all the dependencies that need to be installed, as well as through the steps from getting the application code to running the application in development mode.

## Requirements

Please ensure that the following dependencies are available in your development environment:

- Docker 18.0X+: https://www.docker.com/get-started
- NodeJS 10 LTS: https://nodejs.org/en

For specific installation instructions, please follow the documentation of the corresponding dependency.

## Downloading the Repositories

Download the KlickerUZH application code to your machine by cloning the two main repositories:

- `git clone https://github.com/uzh-bf/klicker-react.git`
- `git clone https://github.com/uzh-bf/klicker-api.git`

Upon successThe klicker-uzh repository is only necessary if you would like to work on the documentation or other auxiliary materials.

## Database and Cache Setup

Once you have installed the Docker environment, you can easily start a local instance of MongoDB and Redis for development. The easiest way is to make use of the prepared Docker Compose file, as provided in the klicker-api repository at https://github.com/uzh-bf/klicker-api/blob/master/docker-compose.yml.

Executing `docker-compose up` in your command line while inside the klicker-api repository will run both an instance of redis and mongodb available on their corresponding local ports (6379 and 27017). To run the services in the background (without occupying a command line window), simply use `docker-compose up -d`.

## Configuration with .env

In a production environment, the KlickerUZH is configured by passing in environment variables into the running Docker container (as explained in detail in [Deployment with Docker](deployment/docker.md)). To simulated this behavior in a development environment, we make use of a `.env` or dotenv configuration file. This file will be loaded into the application environment at runtime.

The klicker-react and klicker-api both have to be parametrized with a `.env` file to be able to run. Basic `.env` files for the two services could look as follows:

klicker-react/.env

```
API_ENDPOINT=http://localhost:4000/graphql
API_ENDPOINT_WS=ws://localhost:4000/graphql
APP_BASE_URL=http://localhost:3000
CACHE_REDIS_ENABLED=true
CACHE_REDIS_HOST=localhost
S3_ROOT_URL=<ENDPOINT>/<BUCKET>
SECURITY_FINGERPRINTING=true
```

klicker-api/.env

```
APP_DOMAIN=localhost
APP_SECRET=hello-world
CACHE_REDIS_ENABLED=true
CACHE_REDIS_HOST=localhost
MONGO_URL=klicker:klicker@localhost:27017/klicker?authSource=admin
MONGO_URL_TEST=klicker:klicker@localhost:27017/klicker-test?authSource=admin

EMAIL_FROM=<FROM_EMAIL>
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=<MAILTRAP_USER>
EMAIL_PASSWORD=<MAILTRAP_PASSWORD>

S3_ENABLED=true
S3_ACCESS_KEY=<S3_ACCESS_KEY>
S3_SECRET_KEY=<S3_SECRET_KEY>
S3_ENDPOINT=<S3_ENDPOINT>
S3_BUCKET=<S3_BUCKET>
```

Please note that the parts in brackets need to be filled in order for the application to run without errors.

## Running the Application

To be able to run a NodeJS application, its NPM dependencies need to be installed. Do this by running `npm install` in both repositories. This will fetch the exact package versions that the KlickerUZH has been developed with, ensuring that you will not encounter errors due to updated packages.

Once you have completed all of the previous steps (including completing the configuration files), you are ready to start the KlickerUZH in development mode. To do so, simply run `npm run dev` in both repositories from your command line.

The klicker-api service should then show a GraphQL development environment at `http://localhost:4000/graphql`. The klicker-react service should serve the application frontend at `http://localhost:3000`.
