FROM mcr.microsoft.com/devcontainers/javascript-node:1-18-bullseye

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>

# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

RUN su node -c "npm install --global pnpm@8" \
  && su node -c "SHELL=bash pnpm setup" \
  && su node -c "pnpm config set store-dir /home/node/.local/share/pnpm/store"
