#!/bin/sh

# load port forwarding config on macOS
sudo pfctl -ef /etc/pf.conf

# enable pnpm support in volta
grep -qxF 'export VOLTA_FEATURE_PNPM=1' ~/.zshrc || echo 'export VOLTA_FEATURE_PNPM=1' >> ~/.zshrc
grep -qxF 'alias pn=pnpm' ~/.zshrc || echo 'alias pn=pnpm' >> ~/.zshrc

# add hosts
# sudo grep -qxF '127.0.0.1 api.klicker.local' ~/.zshrc || sudo echo '127.0.0.1 api.klicker.local' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 pwa.klicker.local' ~/.zshrc || sudo echo '127.0.0.1 pwa.klicker.local' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 manage.klicker.local' ~/.zshrc || sudo echo '127.0.0.1 manage.klicker.local' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 control.klicker.local' ~/.zshrc || sudo echo '127.0.0.1 control.klicker.local' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 auth.klicker.local' ~/.zshrc || sudo echo '127.0.0.1 auth.klicker.local' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 func-responses.klicker.local' ~/.zshrc || sudo echo '127.0.0.1 func-responses.klicker.local' >> ~/.zshrc
# sudo grep -qxF '127.0.0.1 func-response-processor.klicker.local' ~/.zshrc || sudo echo '127.0.0.1 func-response-processor.klicker.local' >> ~/.zshrc

# start postgres, redis, and reverse proxy
podman-compose up postgres redis_exec redis_cache reverse_proxy
