# extend the node alpine base
FROM node:8.7.0-alpine

LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-api"
LABEL version="0.0.1"
EXPOSE 3000

# root application directory
ENV KLICKER_DIR /app

# inject the application dependencies
COPY --chown=1000:0 package.json yarn.lock $KLICKER_DIR/

# switch to the node user (uid 1000)
# non-root as provided by the base image
USER 1000
WORKDIR $KLICKER_DIR

# update permissions for klicker dir
# install yarn packages
RUN set -x \
  && chmod g+rwx $KLICKER_DIR/ \
  && yarn install --frozen-lockfile

# inject application sources and entrypoint
COPY --chown=1000:1000 . $KLICKER_DIR/

# make the entrypoint executable
# RUN chmod u+x $KLICKER_DIR/entrypoint.sh

# configure the entrypoint script
# ENTRYPOINT ["/app/entrypoint.sh"]

# run next in production mode
CMD ["yarn", "start"]
