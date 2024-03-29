#!/bin/sh

# enable pnpm support in volta
grep -qxF 'export VOLTA_FEATURE_PNPM=1' ~/.zshrc || echo 'export VOLTA_FEATURE_PNPM=1' >> ~/.zshrc
grep -qxF 'alias pn=pnpm' ~/.zshrc || echo 'alias pn=pnpm' >> ~/.zshrc

# add hosts
# sudo grep -qxF '127.0.0.1 api.klicker.com' ~/.zshrc || sudo echo '127.0.0.1 api.klicker.com' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 pwa.klicker.com' ~/.zshrc || sudo echo '127.0.0.1 pwa.klicker.com' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 manage.klicker.com' ~/.zshrc || sudo echo '127.0.0.1 manage.klicker.com' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 control.klicker.com' ~/.zshrc || sudo echo '127.0.0.1 control.klicker.com' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 auth.klicker.com' ~/.zshrc || sudo echo '127.0.0.1 auth.klicker.com' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 func-responses.klicker.com' ~/.zshrc || sudo echo '127.0.0.1 func-responses.klicker.com' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 func-response-processor.klicker.com' ~/.zshrc || sudo echo '127.0.0.1 func-response-processor.klicker.com' >> ~/.zshrc

# start postgres, redis, and reverse proxy
docker compose up postgres redis_exec redis_cache reverse_proxy_docker
