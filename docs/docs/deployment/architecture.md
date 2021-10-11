---
id: deployment_architecture
title: Architecture Overview
sidebar_label: Architecture
---

The KlickerUZH is composed of two primary services: a frontend service that serves a React single-page application with Next.js, as well as a backend service that serves a GraphQL API with Express/Node.js and Apollo Server.

The entire application is backed by a MongoDB database as a main data store. Some performance-critical tasks (e.g., data gathered during a running session) are outsourced to a Redis cache service for preprocessing and performance optimization.

![Klicker Architecture](/img/klicker_architecture.png)

## Frontend

**Key Dependencies**

- https://reactjs.org
- https://nextjs.org
- https://www.apollographql.com/docs/react

## Backend

**Key Dependencies**

- https://www.apollographql.com/docs/apollo-server
- https://expressjs.com
- https://nodejs.org/en

## External Dependencies

- https://redis.io in conjunction with https://github.com/luin/ioredis
- https://www.mongodb.com in conjunction with https://mongoosejs.com/
