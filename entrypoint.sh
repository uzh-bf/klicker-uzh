#!/bin/sh
set -e

# embed environment variables
SENTRY=${SENTRY:-'__SENTRY__'}
LOGROCKET=${LOGROCKET:-'__LOGROCKET__'}

# initialize variable lockfiles if they don't yet exist
if [[ ! -f /tmp/klicker_sentry ]]; then echo "__SENTRY__" > /tmp/klicker_sentry; fi
if [[ ! -f /tmp/klicker_logrocket ]]; then echo "__LOGROCKET__" > /tmp/klicker_logrocket; fi

# ensure that the application has not been built already
# take into account any changed environment variables
# => prevent build from rerunning on crash, restart etc.
SENTRY_SAME=`grep -q $SENTRY /tmp/klicker_sentry`
LOGROCKET_SAME=`grep -q $LOGROCKET /tmp/klicker_logrocket`
if [[ -f /tmp/klicker.lock && SENTRY_SAME && LOGROCKET_SAME ]]; then
  echo "Sentry/Logrocket parameters unchanged..."

  exec "$@"
  exit 0
fi

# the application needs to be built
# => run initialization process
echo "Lockfile not found, initializing application..."

echo "Replacing environment variables..."
sed -i 's;__SENTRY__;'"$SENTRY"';g' ./.env
sed -i 's;__LOGROCKET__;'"$LOGROCKET"';g' ./.env

echo "Building application sources..."
yarn run build

echo "Saving lockfiles..."
echo "LOCK" > /tmp/klicker.lock
echo "$SENTRY" > /tmp/klicker_sentry
echo "$LOGROCKET" > /tmp/klicker_logrocket

echo "Sucessfully finished initialization process."

# execute the main command
exec "$@"
