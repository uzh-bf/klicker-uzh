#!/bin/bash

# Run doppler secrets first to ensure we have the environment loaded
eval $(doppler secrets download --no-file --format env --config stg)

# Now run the dump command with the loaded environment variables
# Requires redis installation using, e.g., brew install redis
redis-cli -u rediss://${REDIS_PASS}@${REDIS_HOST}:${REDIS_PORT} --pipe < redis.dump
