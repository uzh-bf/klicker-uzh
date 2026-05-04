FROM node:20.19.4-bookworm-slim

# OS deps: git for branch ops, gh for PRs, jq + curl for !`...` substitutions in prompt.md,
# build-essential + python3 for native pnpm builds (sharp, esbuild, swc, prisma engines).
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      curl \
      ca-certificates \
      jq \
      gnupg \
      build-essential \
      python3 \
      openssh-client \
      sudo \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | gpg --dearmor -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# pnpm pinned to klicker-uzh's packageManager + opencode CLI (sandcastle's opencode agent shells out to it).
# opencode-ai is the npm package (binary `opencode`); it talks to OpenRouter via OPENROUTER_API_KEY.
ENV PNPM_VERSION=10.15.0
RUN npm install -g pnpm@${PNPM_VERSION} opencode-ai

# Non-root user that sandcastle expects ("agent")
RUN useradd --create-home --shell /bin/bash agent \
  && echo "agent ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/agent

# Pnpm store path inside the container; the runner can bind-mount the host store here.
ENV PNPM_HOME=/home/agent/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN mkdir -p /home/agent/.local/share/pnpm && chown -R agent:agent /home/agent/.local

USER agent
WORKDIR /workspace
