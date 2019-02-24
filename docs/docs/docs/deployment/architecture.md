---
id: deployment_architecture
title: Architecture Overview
sidebar_label: Architecture
hide_title: true
---

# Architecture Overview

The Klicker UZH is composed of two services: a frontend service that serves a React single-page application with Next.js, as well as a backend service that serves a GraphQL API with Express/Node.js and Apollo Server.

The entire application is backed by a MongoDB database as a main data store. Some performance-critical tasks are outsourced to a Redis cache service for preprocessing and optimizations.

![Klicker Architecture](assets/klicker_architecture.png 'Klicker Architecture')

## Frontend: klicker-react

**Repository:** https://github.com/uzh-bf/klicker-react

**Key Dependencies**

- https://reactjs.org
- https://nextjs.org
- https://www.apollographql.com/docs/react

## Backend: klicker-api

**Repository:** https://github.com/uzh-bf/klicker-api

**Key Dependencies**

- https://www.apollographql.com/docs/apollo-server
- https://expressjs.com
- https://nodejs.org/en

## External Dependencies

- https://redis.io in conjunction with https://github.com/luin/ioredis
- https://www.mongodb.com in conjunction with https://mongoosejs.com/
