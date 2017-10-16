#!/bin/sh
set -e

APP_PATH='/app'

# embed environment variables
API_URL=${API_URL:-'__API_URL__'}
SENTRY=${SENTRY:-'__SENTRY__'}
LOGROCKET=${LOGROCKET:-'__LOGROCKET__'}

# initialize variable lockfiles if they don't yet exist
if [[ ! -f "$APP_PATH/klicker_api_url.lock" ]]; then echo "__API_URL__" > "$APP_PATH/klicker_api_url.lock"; fi
if [[ ! -f "$APP_PATH/klicker_sentry.lock" ]]; then echo "__SENTRY__" > "$APP_PATH/klicker_sentry.lock"; fi
if [[ ! -f "$APP_PATH/klicker_logrocket.lock" ]]; then echo "__LOGROCKET__" > "$APP_PATH/klicker_logrocket.lock"; fi

# ensure that the application has not been built already
# take into account any changed environment variables
# => prevent build from rerunning on crash, restart etc.
API_URL_SAME=$(grep -q $API_URL $APP_PATH/klicker_api_url.lock)
SENTRY_SAME=$(grep -q $SENTRY $APP_PATH/klicker_sentry.lock)
LOGROCKET_SAME=$(grep -q $LOGROCKET $APP_PATH/klicker_logrocket.lock)
if [[ -f "$APP_PATH/klicker.lock" && API_URL_SAME && SENTRY_SAME && LOGROCKET_SAME ]]; then
  echo "Parameters unchanged, skipping build..."

  exec "$@"
  exit 0
fi

# the application needs to be built
# => run initialization process
echo "Lockfile not found, initializing application..."

echo "Replacing environment variables..."
sed -i 's;__API_URL__;'"$API_URL"';g' "$APP_PATH/.env"
sed -i 's;__SENTRY__;'"$SENTRY"';g' "$APP_PATH/.env"
sed -i 's;__LOGROCKET__;'"$LOGROCKET"';g' "$APP_PATH/.env"

echo "Building application sources..."
yarn run build

echo "Saving lockfiles..."
echo "LOCK" > "$APP_PATH/klicker.lock"
echo "$API_URL" > "$APP_PATH/klicker_api_url.lock"
echo "$SENTRY" > "$APP_PATH/klicker_sentry.lock"
echo "$LOGROCKET" > "$APP_PATH/klicker_logrocket.lock"

echo "Sucessfully finished initialization process."

# execute the main command
exec "$@"
