# extend the node alpine base
FROM node:8-alpine@sha256:40201c973cf40708f06205b22067f952dd46a29cecb7a74b873ce303ad0d11a5

# root application directory
ENV KLICKER_DIR /app
ENV PM_VERSION="2.8.0"

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER node

# install pm2 globally and modify rights of home directory
RUN set -x && yarn global add pm2@$PM_VERSION && chown -R node:0 /home/node

# inject the application dependencies
COPY --chown=node:0 package.json yarn.lock $KLICKER_DIR/
WORKDIR $KLICKER_DIR

# update permissions for klicker dir
# install yarn packages
ARG NODE_ENV="production"
RUN set -x && yarn install --frozen-lockfile

# inject application sources and entrypoint
COPY --chown=node:0 . $KLICKER_DIR/

# run next in production mode
CMD ["yarn", "start:pm"]

# add labels
ARG VERSION="staging"
LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-api"
LABEL version=$VERSION

# expose the main application EXPOSE
# TODO: replace with dynamic port
EXPOSE 80 3000 43554

# TODO: add HEALTHCHECK
