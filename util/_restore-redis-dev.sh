#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Now run the dump command with the loaded environment variables
# Requires redis installation using, e.g., brew install redis
redis-cli -u redis://localhost:6379 --pipe < "${SCRIPT_DIR}/redis.dump"
