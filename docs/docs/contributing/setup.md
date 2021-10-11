---
id: contributing_setup
title: Development Setup
---

To develop on the KlickerUZH, your development environment needs to be setup correctly. This guide will shortly walk you through all the dependencies that need to be installed, as well as through the steps from getting the application code to running the application in development mode.

## Requirements

Please ensure that the following dependencies are available in your development environment:

- Docker 18.0X+: https://www.docker.com/get-started
- NodeJS 14 LTS: https://nodejs.org/en

For specific installation instructions, please follow the documentation of the corresponding dependency.

## Downloading the Repositories

Download the KlickerUZH application code to your machine by cloning the main repository:

- `git clone https://github.com/uzh-bf/klicker-uzh.git`

## Database and Cache Setup

Once you have installed the Docker environment, you can easily start a local instance of MongoDB, Redis, and other auxiliary services for development. The easiest way is to make use of the prepared Docker Compose file, as provided in the repository at https://github.com/uzh-bf/klicker-uzh/blob/dev/docker-compose.yml.

Executing `docker-compose up` in your command line while inside repository will run instances of redis and mongodb available on their corresponding local ports (6379/6380 and 27017). Additional services include minio for a local simulation of cloud S3 storage, and sendria for a local development email service for transactional emails.

To run the services in the background (without occupying a command line window), simply use `docker-compose up -d`.

## Configuration with .env

In a production environment, the KlickerUZH is configured by passing in environment variables into the running Docker container (as explained in detail in [Deployment with Docker](deployment/docker.md)). To simulate this behavior in a development environment, we make use of a `.env` (dotenv) configuration file. This file will be loaded into the application environment at runtime.

The frontend and backend both have to be parametrized with a `.env` file to be able to run. Basic `.env` files for the two services are available in the repository at `.env.template` and should be copied to `.env` in the corresponding folder. Further adjustments can be made if necessary, but the application should run locally without any changes.

## Running the Application

To be able to run NodeJS applications like the KlickerUZH `frontend` and `backend`, NPM dependencies need to be installed. Do this by running `npm install` in both the `frontend` and `backend` folder. This will fetch the exact package versions that the KlickerUZH has been developed with, ensuring that you will not encounter errors due to updated packages.

Once you have completed all of the previous steps (i.e., you have started the Docker dependencies with Docker Compose, you have copied the `.env.template` to `.env`, you have installed the NPM dependencies in both `frontend` and `backend`), you are ready to start the KlickerUZH in development mode. To do so, simply run `npm run dev` in both the `frontend` and `backend` directory from your command line.

The `backend` service should then show a GraphQL development environment at `http://localhost:4000/graphql`. The `frontend` service should serve the application frontend at `http://localhost:3000`.
