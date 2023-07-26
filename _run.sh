#!/bin/sh
sudo pfctl -ef /etc/pf.conf
podman-compose up postgres redis_exec redis_cache reverse_proxy
