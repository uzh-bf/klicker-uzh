#/bin/bash
export $(grep -v '^#' .env | xargs)
mongorestore --gzip --uri=$MONGO_URI_AZURE --archive=dump.archive --nsFrom="$MONGO_DB_FROM.*" --nsTo="$MONGO_DB_TO.*" --writeConcern {w:0} --noIndexRestore
