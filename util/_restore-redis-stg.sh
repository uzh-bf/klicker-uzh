#!/bin/bash

infisical run --env stg -- sh -c 'redis-cli -u rediss://$REDIS_PASS@$REDIS_HOST:$REDIS_PORT --pipe < redis.dump'