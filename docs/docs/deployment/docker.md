---
id: deployment_docker
title: Deploying the KlickerUZH
---

As described in the section on the Klicker [Architecture](deployment/architecture.md), a Klicker application is composed of both instances of the frontend service as well as instances of the backend service. To deploy the KlickerUZH to production, we recommend using a cloud service backed by Kubernetes, as this will offer the best scalability and reliability guarantees. However, a deployment using Docker Compose allows running the KlickerUZH on any compatible VM, and might be preferably for testing or small deployments.

## Deployment to Kubernetes

The recommended way of deploying the KlickerUZH to production is by using our official Helm chart and a production-grade Kubernetes cluster (e.g., with multiple VM and appropriate security setup). Kubernetes allows for easy scaling and improves resiliency when applied properly.

- TODO: https://github.com/uzh-bf/klicker-uzh/tree/dev/deploy

## Deployment with Docker Compose

Alternatively to deploying the KlickerUZH to a Kubernetes cluster, the KlickerUZH can also be deployed using Docker Compose. This allows for a deployment to any machine that has a compatible version of Docker installed. It is recommended to only use this approach in local testing or to simulate a production instance, or for small instances where there is no requirement for load-based scaling.

- TODO: Simple Compose Example -> https://github.com/uzh-bf/klicker-uzh/tree/dev/deploy/compose
- TODO: Traefik Example -> https://github.com/uzh-bf/klicker-uzh/tree/dev/deploy/compose-traefik-proxy
- TODO: Simple Compose Example with Nginx proxy -> ...
-
