#!/bin/sh

# load port forwarding config on macOS
sudo pfctl -ef /etc/pf.conf

# enable pnpm support in volta
grep -qxF 'export VOLTA_FEATURE_PNPM=1' ~/.zshrc || echo 'export VOLTA_FEATURE_PNPM=1' >> ~/.zshrc
grep -qxF 'alias pn=pnpm' ~/.zshrc || echo 'alias pn=pnpm' >> ~/.zshrc

# start postgres, redis, and reverse proxy
podman-compose up postgres redis_exec redis_cache reverse_proxy
