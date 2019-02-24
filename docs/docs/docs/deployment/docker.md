---
id: deployment_docker
title: Deploying the Klicker UZH
hide_title: true
---

# Deploying the Klicker UZH

As described in the section on the Klicker [Architecture](deployment/architecture.md), a Klicker application is composed of both an instance of _klicker-react_ for the frontend service as well as _klicker-api_ for the backend service.

To deploy the KlickerUZH to production, we recommend using a cloud service backed by Kubernetes, as this will offer the best scalability and reliability guarantees. However, the next section will also shortly describe an alternative way using simple Docker Compose scripts.

## Deployment with Docker Compose

Alternatively to deploying the Klicker UZH to a Kubernetes cluster, the Klicker UZH could also be deployed using Docker Compose. This allows for a deployment to any machine that has a compatible version of Docker installed. It is recommended to only use this approach in local testing or to simulate a production instance.

```yaml
version: '3'
services:
  # klicker-react
  # see https://github.com/uzh-bf/klicker-react
  react:
    # use the prebuilt image from docker hub
    image: klicker-react
    # alternatively build the image from sources
    # build: klicker-react
    ports:
      - '3000:3000'
    environment:
      CACHE_REDIS_ENABLED: 'true'
      CACHE_REDIS_HOST: 'redis'
      # ... other settings
      # see configuration.md

  # klicker-api
  # see https://github.com/uzh-bf/klicker-api
  api:
    # use the prebuilt image from docker hub
    image: klicker-api
    # alternatively build the image from sources
    # build: klicker-api
    ports:
      - '4000:3000'
    environment:
      APP_PORT: 3000
      CACHE_REDIS_ENABLED: 'true'
      CACHE_REDIS_HOST: 'redis'
      MONGO_URL: 'mongodb/klicker'
      # ... other settings
      # see configuration.md

  # redis cache
  # see https://hub.docker.com/_/redis
  redis:
    image: 'redis:3-32bit'
    command: redis-server --appendonly yes
    ports:
      - '6379:6379'
    volumes:
      # define a volume for redis persistence
      - xyz:/data

  # mongodb document store
  # see https://hub.docker.com/_/mongo
  mongodb:
    image: 'mongo:4.0'
    ports:
      - '27017:27017'
    volumes:
      # define a volume for the main mongodb data directory
      - xyz:/data/db
```

## Deployment to Kubernetes

The recommended way of deploying the Klicker UZH to production is backed by a Kubernetes cluster. This allows for easy scaling and improves resiliency. The deployment to Kubernetes is composed of several steps that vary depending on the type of cluster that is used. These steps roughly go as follows:

- Add a deployment config for both klicker-react and klicker-api
- Add routes for both services (separate subdomains)
  - Optional: Add custom SSL certificates for the routes
- Create config maps for klicker-react and klicker-api configuration
  - Attach the config maps to the corresponding service
- Add health checks (readiness and liveness probes) for klicker-react and klicker-api
  - klicker-react: e.g., `GET / on port 3000 (HTTP) 10s delay, 2s timeout`
  - klicker-api: e.g., `GET /.well-known/apollo/server-health on port 4000 (HTTP) 30s delay, 1s timeout`
- Optional: Add autoscaler configuration

## Configuration

The Klicker UZH services can be configured by simply passing in the settings as environment variables (https://12factor.net/config). In the case of Kubernetes, the easiest way to configure the Klicker is by parametrizing the two config maps as shown below and attaching them to the respective service.

If the Klicker UZH is to be deployed using Docker Compose or another orchestrator, the configuration variables would simply need to be passed in one by one using the corresponding notation.

Please note that not all shown configuration options are required, and that there are more configuration options that have not been included in the examples below. A full view of the configuration options can be found in https://github.com/uzh-bf/klicker-api/blob/master/src/klicker.conf.js
and https://github.com/uzh-bf/klicker-api/blob/master/src/klicker.conf.js.

### klicker-api

```yaml
apiVersion: v1
kind: ConfigMap

metadata:
  name: klicker-api-config
  namespace: klicker

data:
  # the application secret
  # used for JWT verification and other sensitive procedures
  APP_SECRET: 'xyz'

  # the base url of the application (without protocol)
  APP_BASE_URL: 'app.klicker.uzh.ch'

  # the subdomain of the api service
  APP_DOMAIN: 'api.klicker.uzh.ch'

  # whether the cookies should be restricted to https
  APP_HTTPS: 'true'
  APP_SECURE: 'true'

  # whether express should trust a forwarding proxy
  # needs to be set to get real client ips in a cloud environment (e.g., OpenShift)
  APP_TRUST_PROXY: 'true'

  # settings and credentials for the redis cache service
  CACHE_REDIS_ENABLED: 'true'
  CACHE_REDIS_PASSWORD: 'xyz'
  CACHE_REDIS_HOST: redis-prod

  # where the klicker application should be sending transactional emails from
  EMAIL_FROM: 'klicker.support@uzh.ch'
  EMAIL_HOST: 'smtp.uzh.ch'
  EMAIL_PASSWORD: 'xyz'
  EMAIL_USER: 'klicker.support@uzh.ch'

  # the full url of the main application database
  MONGO_URL: 'xyz:xyz@1.1.1.1/klicker'

  # the credentials and location of the main S3 bucket
  # this bucket is used for file uploads
  S3_ACCESS_KEY: 'xyz'
  S3_BUCKET: 'klicker-prod'
  S3_ENABLED: 'true'
  S3_ENDPOINT: 'klicker-files.s3.amazonaws.com'
  S3_SECRET_KEY: 'xyz'

  # miscellaneous security settings
  SECURITY_CORS_ORIGIN: 'https://app.klicker.uzh.ch'
  SECURITY_CORS_CREDENTIALS: 'true'
  SECURITY_EXPECT_CT_ENABLED: 'false'
  SECURITY_EXPECT_CT_REPORT_URI: 'xyz'
  SECURITY_HSTS_ENABLED: 'false'
  SECURITY_RATE_LIMIT_ENABLED: 'false'

  # connection to an elastic apm service (optional)
  SERVICES_APM_ENABLED: 'false'
  SERVICES_APM_SECRET_TOKEN: 'xyz'
  SERVICES_APM_SERVER_URL: 'xyz'
  SERVICES_APM_SERVICE_NAME: 'xyz'

  # connection to apollo engine (optional)
  SERVICES_APOLLO_ENGINE_ENABLED: 'false'
  SERVICES_APOLLO_ENGINE_API_KEY: 'xyz'

  # connection to sentry for error logging (optional)
  SERVICES_SENTRY_ENABLED: 'false'
  SERVICES_SENTRY_DSN: 'xyz'

  # conenction to a slack channel for event logging (optional)
  SERVICES_SLACK_ENABLED: 'false'
  SERVICES_SLACK_WEBHOOK: 'xyz'
```

### klicker-react

```yaml
apiVersion: v1
kind: ConfigMap

metadata:
  name: klicker-react-config
  namespace: klicker

data:
  # the main api endpoint (over HTTP/S and Websockets)
  API_ENDPOINT: 'https://api.klicker.uzh.ch/graphql'
  API_ENDPOINT_WS: 'wss://api.klicker.uzh.ch/graphql'

  # the base url of the application (with protocol)
  APP_BASE_URL: 'https://app.klicker.uzh.ch'

  # an alternative shortdomain (i.e. "join" url)
  # this domain should redirect to the main base url
  # i.e., uzh.voting/abc should redirect to app.klicker.uzh.ch/join/abc
  APP_JOIN_URL: 'uzh.voting'

  # whether the query contents should be persisted/cached
  # this optimizes performance as queries can be identified by a single ID
  APP_PERSIST_QUERIES: 'true'

  # whether express should trust a forwarding proxy
  # needs to be set to get real client ips in a cloud environment (e.g., OpenShift)
  APP_TRUST_PROXY: 'true'

  # settings and credentials for the redis cache service
  CACHE_REDIS_PASSWORD: 'xyz'
  CACHE_REDIS_ENABLED: 'true'
  CACHE_REDIS_HOST: 'redis'

  # the root url of the S3 bucket
  # used by the frontend to display uploaded images
  S3_ROOT_URL: 'https://klicker-files.s3.eu-central-1.amazonaws.com/klicker-prod'

  # miscellaneous security settings
  SECURITY_CSP_ENABLED: 'false'
  SECURITY_CSP_REPORT_URI: 'xyz'
  SECURITY_EXPECT_CT_ENABLED: 'false'
  SECURITY_EXPECT_CT_REPORT_URI: 'xyz'
  SECURITY_FRAMEGUARD_ENABLED: 'false'
  SECURITY_HSTS_ENABLED: 'false'

  # connection to an elastic apm service (optional)
  SERVICES_APM_ENABLED: 'true'
  SERVICES_APM_SECRET_TOKEN: 'xyz'
  SERVICES_APM_SERVER_URL: 'xyz'
  SERVICES_APM_SERVICE_NAME: 'xyz'

  # connection to google analytics (optional)
  SERVICES_GOOGLE_ANALYTICS_ENABLED: 'true'
  SERVICES_GOOGLE_ANALYTICS_TRACKING_ID: 'xyz'

  # connection to logrocket (optional)
  SERVICES_LOGROCKET_ENABLED: 'true'
  SERVICES_LOGROCKET_APP_ID: 'xyz'

  # connection to slaask (optional)
  SERVICES_SLAASK_ENABLED: 'true'
  SERVICES_SLAASK_WIDGET_KEY: 'xyz'
```
