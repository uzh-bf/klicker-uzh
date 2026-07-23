FROM ghcr.io/astral-sh/uv:0.11.6@sha256:b1e699368d24c57cda93c338a57a8c5a119009ba809305cc8e86986d4a006754 AS uv

FROM docker.io/library/python:3.12.11-slim-bookworm@sha256:519591d6871b7bc437060736b9f7456b8731f1499a57e22e6c285135ae657bf7 AS builder

COPY --from=uv /uv /bin/uv

RUN sed -i \
      -e 's|URIs: http://deb.debian.org/debian$|URIs: http://snapshot.debian.org/archive/debian/20250929T000000Z|' \
      -e 's|URIs: http://deb.debian.org/debian-security$|URIs: http://snapshot.debian.org/archive/debian-security/20250929T000000Z|' \
      /etc/apt/sources.list.d/debian.sources && \
    printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99snapshot && \
    apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app/apps/analytics

COPY apps/analytics/pyproject.toml apps/analytics/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/analytics/src/modules/chat_topic_clustering/model.py /tmp/embedding_model.py
RUN --mount=type=cache,target=/root/.cache/huggingface \
    .venv/bin/python -c "import runpy, shutil; from huggingface_hub import hf_hub_download; from sentence_transformers import SentenceTransformer; config = runpy.run_path('/tmp/embedding_model.py'); model_path = config['BUNDLED_MODEL_PATH']; SentenceTransformer(config['MODEL_ID'], revision=config['MODEL_REVISION'], tokenizer_kwargs=config['TOKENIZER_KWARGS']).save(str(model_path), create_model_card=False); shutil.copyfile(hf_hub_download(repo_id=config['MODEL_ID'], filename='README.md', revision=config['MODEL_REVISION']), model_path / 'UPSTREAM_MODEL_CARD.md')"
COPY apps/analytics/third_party/multilingual-e5-base.LICENSE /opt/models/multilingual-e5-base/LICENSE


FROM docker.io/library/python:3.12.11-slim-bookworm@sha256:519591d6871b7bc437060736b9f7456b8731f1499a57e22e6c285135ae657bf7 AS runtime

RUN sed -i \
      -e 's|URIs: http://deb.debian.org/debian$|URIs: http://snapshot.debian.org/archive/debian/20250929T000000Z|' \
      -e 's|URIs: http://deb.debian.org/debian-security$|URIs: http://snapshot.debian.org/archive/debian-security/20250929T000000Z|' \
      /etc/apt/sources.list.d/debian.sources && \
    printf 'Acquire::Check-Valid-Until "false";\n' > /etc/apt/apt.conf.d/99snapshot && \
    apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates libgomp1 && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 10001 analytics && \
    useradd --system --uid 10001 --gid analytics --home-dir /app/apps/analytics analytics

WORKDIR /app/apps/analytics

COPY --from=builder --chown=10001:10001 /app/apps/analytics/.venv .venv
COPY --from=builder --chown=10001:10001 /opt/models /opt/models
COPY --chown=10001:10001 apps/analytics/src src

ENV HATCHET_CLIENT_WORKER_HEALTHCHECK_ENABLED=true \
    HATCHET_CLIENT_WORKER_HEALTHCHECK_PORT=8001 \
    HF_HUB_OFFLINE=1 \
    HOME=/tmp \
    PATH="/app/apps/analytics/.venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TRANSFORMERS_OFFLINE=1

EXPOSE 8001

USER analytics

CMD ["python", "-m", "src.hatchet_worker"]
