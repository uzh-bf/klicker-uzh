---
id: deployment_requirements
title: Requirements
---

To be able to deploy the Klicker UZH as a private instance, several requirements need to be fulfilled. A supported version of the following dependencies need to be setup:

Docker 18.0X, MongoDB 4.X, Redis 3.X

## Docker

The Klicker UZH has been developed and optimized for deployment to a Docker-based container infrastructure (e.g., with Kubernetes). As such, a current version of Docker is required to run the application. We recommend using at least one of the earlier **18.0X** versions, as these have been verified as working.

For more information, please refer to the official Docker documentation on https://docs.docker.com/get-started/. Please note that we currently do not support running the Klicker UZH as a native NodeJS application (i.e., without Docker), even though nothing in particular should prevent this running mode from being implemented.

## MongoDB

The Klicker UZH platform is backed by MongoDB, an open-source document database (see https://www.mongodb.com/). We verify and optimize for the current **4.x** version range. It is recommended to run MongoDB on bare-metal or in a dedicated VM, as there are potential issues with running a database in a cloud-native environment (i.e. with Docker).

## Redis

As a means of optimizing performance and storing temporary transactional data, we make use of the Redis cache service. We currently support the **3.x** version range.
