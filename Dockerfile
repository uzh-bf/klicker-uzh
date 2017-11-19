# extend the node alpine base
FROM node:8-alpine@sha256:f89f73ef56dcfb5c39ed3e7ae69075dc8145a3a6bf2df83b1d840f204cf90c0b

ENV KLICKER_DIR="/app"
ENV NODE_ENV="production"

# setup labels
LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-react"
LABEL version="1.0.0-beta.1"
EXPOSE 3000

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000

# inject the application dependencies
COPY --chown=1000:0 package.json yarn.lock $KLICKER_DIR/
WORKDIR $KLICKER_DIR

# update permissions for klicker dir
# install yarn packages
RUN set -x && yarn install --frozen-lockfile

# inject application sources and entrypoint
COPY --chown=1000:0 . $KLICKER_DIR/

# define available build arguments
# these are bundled into the js in the next step
ARG API_URL
ARG SENTRY
ARG LOGROCKET

# pre-build the application
RUN set -x && yarn run build

# run next in production mode
CMD ["yarn", "start"]
