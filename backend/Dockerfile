# extend the node alpine base
FROM node:16-alpine

# root application directory
ENV APP_DIR /app
ENV NODE_ENV="production"

# install tini
RUN set -x && apk add --no-cache tini

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000

# inject the application dependencies
COPY --chown=1000:0 package.json package-lock.json $APP_DIR/
WORKDIR $APP_DIR

# install yarn packages for the specified environment
# HACK: disable ignore-engines workaround
RUN set -x && npm ci

# inject application sources and entrypoint
COPY --chown=1000:0 . $APP_DIR/

# run the application in production mode
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]

# add labels
ARG VERSION="canary"
LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-api"
LABEL version=$VERSION

# expose the main application port
EXPOSE 4000

# setup a HEALTHCHECK
HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:4000/.well-known/apollo/server-health || exit 1
