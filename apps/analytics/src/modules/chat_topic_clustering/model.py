"""Pinned, offline-capable embedding model loading."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

MODEL_ID = "intfloat/multilingual-e5-base"
MODEL_REVISION = "d128750597153bb5987e10b1c3493a34e5a4502a"
BUNDLED_MODEL_PATH = Path("/opt/models/multilingual-e5-base")
MODEL_PATH_ENV = "ANALYTICS_EMBEDDING_MODEL_PATH"
TOKENIZER_KWARGS = {"fix_mistral_regex": True}

_model: Any = None


def _model_source() -> tuple[str, str | None, bool]:
    override = os.environ.get(MODEL_PATH_ENV)
    local_path = Path(override) if override else BUNDLED_MODEL_PATH

    if local_path.is_dir():
        return str(local_path), None, True
    if override:
        raise RuntimeError(f"{MODEL_PATH_ENV} does not point to a model directory")

    return MODEL_ID, MODEL_REVISION, False


def get_embedding_model() -> Any:
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        source, revision, local_files_only = _model_source()
        _model = SentenceTransformer(
            source,
            revision=revision,
            local_files_only=local_files_only,
            tokenizer_kwargs=TOKENIZER_KWARGS,
        )
    return _model
