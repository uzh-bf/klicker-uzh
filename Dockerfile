# extend the node alpine base
FROM node:8-alpine@sha256:a55d3e87802b2a8464b3bfc1f8c3c409f89e9b70a31f1dccce70bd146501f1a0

# root application directory
ENV KLICKER_DIR="/app"
ENV NODE_ENV="production"

# install tini
RUN apk add --no-cache tini

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000

# inject the application dependencies
COPY --chown=1000:0 package.json yarn.lock $KLICKER_DIR/
WORKDIR $KLICKER_DIR

# update permissions for klicker dir
# install yarn packages for the specified environment
RUN set -x && yarn install --frozen-lockfile

# inject application sources and entrypoint
COPY --chown=1000:0 . $KLICKER_DIR/

# pre-build the application
# define available build arguments
# these are then bundled into the js
ARG API_URL
ARG SENTRY_DSN
ARG LOGROCKET
ARG FINGERPRINTING="true"
ARG VERSION="staging"
RUN set -x && yarn run build

# run next in production mode
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# add labels
LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-api"
LABEL version=$VERSION

# expose the main application port
EXPOSE 3000

# setup a HEALTHCHECK
HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:3000/ || exit 1
