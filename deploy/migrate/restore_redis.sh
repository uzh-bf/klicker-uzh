#!/bin/bash
# export $(grep -v '^#' .env | xargs)

# python redisdl.py --host $REDIS_TARGET_HOSTNAME --port $REDIS_TARGET_PORT --password "$REDIS_TARGET_PASSWORD" --db 0 --ssl -l dump.json
exo storage setacl sos://klicker-qa/ --recursive public-read
