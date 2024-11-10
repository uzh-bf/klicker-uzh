#!/bin/bash

# Run doppler secrets first to ensure we have the environment loaded
eval $(doppler secrets download --no-file --format env --config prd)

# Now run the dump command with the loaded environment variables
# Requires redis installation using, e.g., brew install redis
redis-cli -u redis://localhost:6379 --pipe < redis.dump
