---
id: deployment_requirements
title: Requirements
---

To be able to deploy the Klicker UZH as a private instance, several requirements need to be fulfilled. A supported version of the following dependencies need to be set up:

Docker, MongoDB 4.X, Redis 6.X

## Docker

The Klicker UZH has been developed and optimized for deployment to a Docker-based container infrastructure (e.g., with Kubernetes). As such, a current version of Docker is required to run the application.

For more information, please refer to the official Docker documentation on https://docs.docker.com/get-started/. Please note that we currently do not support running the KlickerUZH as a native NodeJS application (i.e., without Docker), even though nothing, in particular, should prevent this running mode from being implemented.

## MongoDB

The KlickerUZH platform is backed by MongoDB, an open-source document database (see https://www.mongodb.com/). We verify and optimize for the current **4.x** version range. It is recommended to run MongoDB on bare-metal or in a dedicated VM, or using a dedicated cloud service like Azure CosmosDB.

## Redis

As a means of optimizing performance and storing temporary transactional data, we make use of the Redis cache service. We currently support the **.x** version range.
