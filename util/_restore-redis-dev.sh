#!/bin/bash

# Now run the dump command with the loaded environment variables
# Requires redis installation using, e.g., brew install redis
redis-cli -u redis://localhost:6379 --pipe < redis.dump
