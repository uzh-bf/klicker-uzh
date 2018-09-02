# extend the node alpine base
FROM node:8-alpine@sha256:cf4ea9156ef964eaf0c4df65da3f4fed7358dbe31149ca105c7684a5858195d8

# root application directory
ENV APP_DIR="/app"
ENV NODE_ENV="production"

# install tini
RUN set -x && apk add --no-cache tini

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000

# inject the application dependencies
COPY --chown=1000:0 package.json yarn.lock $APP_DIR/
WORKDIR $APP_DIR

# install yarn packages for the specified environment
RUN set -x && yarn install --frozen-lockfile

# run the application in development mode
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["yarn", "dev"]

# expose the main application port
EXPOSE 3000

# setup a HEALTHCHECK
HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:3000/ || exit 1
