#!/bin/sh
set -e

# embed environment variables
SENTRY=${SENTRY:-'__SENTRY__'}
LOGROCKET=${LOGROCKET:-'__LOGROCKET__'}

# ensure that the application has not been built already
# take into account any changed environment variables
# => prevent build from rerunning on crash, restart etc.
if [[ ! -f /tmp/klicker.lock || ! grep -q $SENTRY /tmp/klicker_sentry || ! grep -q $LOGROCKET /tmp/klicker_logrocket ]];
then

  echo "Lockfile not found, initializing application..."

  echo "Replacing environment variables..."
  sed -i 's;__SENTRY__;'"$SENTRY"';g' ./src/lib/env.js
  sed -i 's;__LOGROCKET__;'"$LOGROCKET"';g' ./src/lib/env.js

  echo "Building application sources..."
  yarn run build

  echo "Saving lockfile..."
  touch /tmp/klicker.lock
  echo "$SENTRY" >> /tmp/klicker_sentry
  echo "$LOGROCKET" >> /tmp/klicker_logrocket

  echo "Sucessfully finished initialization process."

fi

# execute the main command
exec "$@"
