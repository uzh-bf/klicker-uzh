# extend the node alpine base
FROM node:15-alpine

# root application directory
ENV KLICKER_DIR="/app"
ENV NODE_ENV="production"

# install tini
RUN apk add --no-cache tini

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000

# inject the application dependencies
COPY --chown=1000:0 package.json package-lock.json $KLICKER_DIR/
WORKDIR $KLICKER_DIR

# install yarn packages for the specified environment
RUN set -x && npm ci

# inject application sources
COPY --chown=1000:0 . $KLICKER_DIR/

# pre-build the nextjs sources
RUN set -x && npm run build

# run next in production mode
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# add labels
ARG VERSION="canary"
LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-api"
LABEL version=$VERSION

# expose the main application port
EXPOSE 3000

# setup a HEALTHCHECK
HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:3000/ || exit 1
