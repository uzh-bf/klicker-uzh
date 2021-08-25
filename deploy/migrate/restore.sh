mongorestore --gzip --uri=$MONGO_URI_AZURE --archive=dump.archive --nsFrom="klicker-prod.*" --nsTo="klicker-dev.*" --writeConcern {w:0} --noIndexRestore
