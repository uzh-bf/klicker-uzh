#!/bin/sh
mongodump -h $DB_HOST:27017 -u $DB_USER -p $DB_PASS --gzip --archive=klicker-prod.archive --authenticationDatabase klicker-prod
