# extend the node alpine base
FROM node:8.1.2-alpine

MAINTAINER Roland Schläfli <roland.schlaefli@bf.uzh.ch>
LABEL NAME klicker-react
LABEL VERSION 0.0.1
EXPOSE 3000

# root application directory
ENV KLICKER_DIR /app

# inject the entrypoint and make it runnable
COPY entrypoint.sh /entrypoint.sh
RUN chown 1000:1000 /entrypoint.sh \
  && chmod u+x /entrypoint.sh

# inject the application dependencies
COPY package.json yarn.lock $KLICKER_DIR/

WORKDIR $KLICKER_DIR

# install yarn packages
RUN set -x \
  && yarn install

# inject application sources
COPY . KLICKER_DIR/

# switch to the node user (uid 1000)
# non-root as provided by the base image
RUN chown -R 1000:1000 $KLICKER_DIR
USER 1000

# configure the entrypoint script
ENTRYPOINT ["/entrypoint.sh"]

# run next in production mode
CMD ["yarn", "run", "start"]
