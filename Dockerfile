# extend the node alpine base
FROM node:8-alpine

LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-react"
LABEL version="0.0.1"
EXPOSE 3000

# root application directory
ENV KLICKER_DIR /app

# TODO: extract these environment variables
ENV API_URL "https://api-uniz-klicker.appuioapp.ch/graphql"
ENV SENTRY "https://16014e4cbb9e48a39a439e2c076ccc4f@sentry.ibf-devops.ch/6"
ENV LOGROCKET "vqm2qj/klicker"
# ENV API_URL '__API_URL__'
# ENV SENTRY '__SENTRY__'
# ENV LOGROCKET '__LOGROCKET__'

# inject the application dependencies
COPY --chown=1000:0 package.json yarn.lock $KLICKER_DIR/

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000
WORKDIR $KLICKER_DIR

# update permissions for klicker dir
# install yarn packages
RUN set -x \
  && yarn install --frozen-lockfile

# inject application sources and entrypoint
COPY --chown=1000:0 . $KLICKER_DIR/

# make the entrypoint executable
# RUN chmod u+x $KLICKER_DIR/entrypoint.sh \
#  && yarn run build
RUN set -x \
  && yarn run build

# configure the entrypoint script
# ENTRYPOINT ["/app/entrypoint.sh"]

# run next in production mode
CMD ["yarn", "start"]
