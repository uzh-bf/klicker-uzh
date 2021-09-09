#/bin/bash
export $(grep -v '^#' .env | xargs)
mongodump --gzip --archive=dump.archive --db=klicker-prod --uri=$MONGO_URI_PROD
