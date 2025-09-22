#!/bin/bash

# Run doppler secrets first to ensure we have the environment loaded
eval $(doppler secrets download --no-file --format env --config prd)

# Now run the dump command with the loaded environment variables
./upstash-redis-dump -host "${REDIS_HOST}" -port "${REDIS_PORT}" -pass "${REDIS_PASS}" -tls > redis.dump
