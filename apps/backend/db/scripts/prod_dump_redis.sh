#!/bin/sh
# oc rsync redis-prod-17-ww4gn:/var/lib/redis/data/dump.rdb .
rm -rf /tmp/redis-data/dump.rdb
cp dump.rdb /tmp/redis-data/dump.rdb
