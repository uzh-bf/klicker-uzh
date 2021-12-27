FROM node:17.3.0-alpine

WORKDIR /app

ENV NODE_ENV "production"

# install tini
RUN apk add --no-cache tini \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nextjs -u 1001

# inject the application dependencies
COPY --chown=nextjs:nodejs package.json package-lock.json semantic.json /app/

# install yarn packages for the specified environment
RUN set -x && npm ci

# inject application sources
COPY --chown=nextjs:nodejs . /app/


# pre-build the nextjs sources
RUN set -x && npm run build

# switch to the node user
# non-root as provided by the base image
USER nextjs

# run next in production mode
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/server.js"]

# add labels
LABEL maintainer="Roland Schlaefli <roland.schlaefli@bf.uzh.ch>"
LABEL name="@klicker-uzh/frontend"

# expose the main application port
EXPOSE 3000

# setup a HEALTHCHECK
HEALTHCHECK --interval=5m --timeout=3s \
  CMD curl -f http://localhost:3000/ || exit 1
