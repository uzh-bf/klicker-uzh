# extend the node alpine base
FROM node:8-alpine@sha256:f89f73ef56dcfb5c39ed3e7ae69075dc8145a3a6bf2df83b1d840f204cf90c0b

LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-api"
LABEL version="1.0.0-beta.1"
EXPOSE 3000

# root application directory
ENV KLICKER_DIR /app
ENV NODE_ENV "production"

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
COPY --chown=1000:1000 . $KLICKER_DIR/

# run next in production mode
CMD ["yarn", "start"]
