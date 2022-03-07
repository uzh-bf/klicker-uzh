#!/bin/sh
mongorestore -h localhost:27017 -u klicker -p klicker --gzip --archive=klicker-prod.archive
