# extend the node alpine base
FROM node:8-alpine@sha256:5afa874abbb18b38de0eb3b0b8bf168a01c1b65845b949104c3a50c050819bbc

# root application directory
ENV KLICKER_DIR="/app"
ENV PM_VERSION="2.8.0"

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000

# install pm2 globally
RUN set -x && yarn global add pm2@$PM_VERSION

# inject the application dependencies
COPY --chown=1000:0 package.json yarn.lock $KLICKER_DIR/
WORKDIR $KLICKER_DIR

# update permissions for klicker dir
# install yarn packages for the specified environment
ARG NODE_ENV="production"
RUN set -x && yarn install --frozen-lockfile

# inject application sources and entrypoint
COPY --chown=1000:0 . $KLICKER_DIR/

# pre-build the application
# define available build arguments
# these are then bundled into the js
ARG API_URL
ARG SENTRY_DSN
ARG LOGROCKET
ARG HOTJAR
ARG OPBEAT_APP_ID_REACT
ARG OPBEAT_ORG_ID_REACT
ARG FINGERPRINTING="true"
ARG VERSION="staging"
RUN set -x && yarn run build

# run next in production mode
CMD ["yarn", "start:pm"]

# add labels
LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-api"
LABEL version=$VERSION

# expose the main application EXPOSE
# TODO: replace with dynamic port
EXPOSE 80 3000 43554

# TODO: add HEALTHCHECK
