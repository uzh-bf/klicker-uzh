---
id: deployment_requirements
title: Requirements
---

:::warning
The KlickerUZH documentation on deployment is currently a work in progress. We are working on an improved version that will make it much easier to deploy your own instance of the KlickerUZH.
:::

To be able to deploy the Klicker UZH as a private instance, several requirements need to be fulfilled. A supported version of the following dependencies need to be set up and correctly configured.

## Docker

The Klicker UZH has been developed and optimized for deployment to a Docker-based container infrastructure (e.g., with Docker Compose or Kubernetes). As such, a current version of Docker is required to run the application.

For more information, please refer to the official Docker documentation on https://docs.docker.com/get-started/. Please note that we currently do not officially support running the KlickerUZH as a native NodeJS application (i.e., without Docker).

## MongoDB

The KlickerUZH platform is backed by MongoDB, an open-source document database (see https://www.mongodb.com/). We verify and optimize for the current **4.x** version range. It is recommended to run MongoDB on bare-metal or in a dedicated VM, or using a dedicated cloud service like Azure CosmosDB.

<!-- - TODO: hosting examples (e.g., cosmosdb) -->

## Redis

As a means of optimizing performance and storing temporary transactional data, we make use of the Redis cache service. We officially support and use the **5.x** version range.

<!-- - TODO: why do we use two instances
- TODO: one instance needs persistence
- TODO: hosting examples (e.g., upstash) -->
