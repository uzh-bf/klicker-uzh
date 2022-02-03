---
id: deployment_docker
title: Deploying the KlickerUZH
---

:::warning
The KlickerUZH documentation on deployment is currently a work in progress. We are working on an improved version that will make it much easier to deploy your own instance of the KlickerUZH.
:::

As described in the section on the Klicker [Architecture](deployment/architecture.md), a Klicker application is composed of both instances of the frontend service as well as instances of the backend service. To deploy the KlickerUZH to production, we recommend using a cloud service backed by Kubernetes, as this will offer the best scalability and reliability guarantees. However, a deployment using Docker Compose allows running the KlickerUZH on any compatible VM, and might be preferably for testing or small deployments.

## Deployment to Kubernetes

:::info
Our official Helm chart is not yet documented and only customizable to the extent that we require. However, the chart is stable and already powering our own production instance of the KlickerUZH. Feel free to already have a look at the code and give us feedback on what you might need in addition.
:::

The recommended way of deploying the KlickerUZH to production is by using our official Helm chart and a production-grade Kubernetes cluster (e.g., with multiple nodes and an appropriate security setup).

Our Helm chart is located in the KlickerUZH repo at <https://github.com/uzh-bf/klicker-uzh/tree/dev/deploy/charts/klicker-uzh>.

## Deployment with Docker Compose

:::info
The Docker Compose examples are provided as a guide to allow for easier setup and getting started with hosting the KlickerUZH. For optimal security and performance, you need to adapt these templates to your specific needs.
:::

Alternatively to deploying the KlickerUZH to a Kubernetes cluster, the KlickerUZH and its requirements can also be deployed using Docker Compose. This allows for a deployment to any machine that has a compatible version of Docker installed. It is recommended to only use this approach in a small scale or when testing, especially where there is no requirement for load-based scaling.

Our Docker Compose templates are located in the KlickerUZH repo:

- KlickerUZH with exposed ports <https://github.com/uzh-bf/klicker-uzh/tree/dev/deploy/compose>
- KlickerUZH with Traefik Proxy <https://github.com/uzh-bf/klicker-uzh/tree/dev/deploy/compose-traefik-proxy>
- WIP: KlickerUZH with simple Nginx Proxy

If there are further templates that you require, or if you are deploying the KlickerUZH using a different approach, feel free to create an issue or a pull request to contribute your own template.
