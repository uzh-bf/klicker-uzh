# extend the node alpine base
FROM node:8.7.0-alpine

LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="klicker-react"
LABEL version="0.0.1"
EXPOSE 3000

# root application directory
ENV KLICKER_DIR /app
WORKDIR $KLICKER_DIR

# inject the application dependencies
COPY package.json yarn.lock $KLICKER_DIR/

# inject application sources and entrypoint
COPY . $KLICKER_DIR/

# switch to the node user (uid 1000)
# non-root as provided by the base image
RUN chown -R 1000:1000 "$KLICKER_DIR/" \
  && chmod u+x $KLICKER_DIR/entrypoint.sh
USER 1000

# install yarn packages
RUN set -x \
  && yarn install --frozen-lockfile

# configure the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]

# run next in production mode
CMD ["yarn", "start"]
