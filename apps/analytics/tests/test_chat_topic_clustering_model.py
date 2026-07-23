from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest

from src.modules.chat_topic_clustering import model


class _SentenceTransformer:
    calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

    def __init__(self, *args: object, **kwargs: object) -> None:
        self.calls.append((args, kwargs))


@pytest.fixture(autouse=True)
def reset_model(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_module = types.ModuleType("sentence_transformers")
    setattr(fake_module, "SentenceTransformer", _SentenceTransformer)
    monkeypatch.setitem(sys.modules, "sentence_transformers", fake_module)
    monkeypatch.setattr(model, "_model", None)
    _SentenceTransformer.calls.clear()


def test_remote_model_load_pins_the_revision(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv(model.MODEL_PATH_ENV, raising=False)
    monkeypatch.setattr(model, "BUNDLED_MODEL_PATH", tmp_path / "not-bundled")

    loaded = model.get_embedding_model()

    assert isinstance(loaded, _SentenceTransformer)
    assert _SentenceTransformer.calls == [
        (
            (model.MODEL_ID,),
            {
                "revision": model.MODEL_REVISION,
                "local_files_only": False,
                "tokenizer_kwargs": model.TOKENIZER_KWARGS,
            },
        )
    ]


def test_bundled_model_load_is_offline(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    bundled = tmp_path / "model"
    bundled.mkdir()
    monkeypatch.delenv(model.MODEL_PATH_ENV, raising=False)
    monkeypatch.setattr(model, "BUNDLED_MODEL_PATH", bundled)

    model.get_embedding_model()

    assert _SentenceTransformer.calls == [
        (
            (str(bundled),),
            {
                "revision": None,
                "local_files_only": True,
                "tokenizer_kwargs": model.TOKENIZER_KWARGS,
            },
        )
    ]


def test_explicit_missing_model_path_fails_closed(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    missing = tmp_path / "missing"
    monkeypatch.setenv(model.MODEL_PATH_ENV, str(missing))

    with pytest.raises(RuntimeError, match=model.MODEL_PATH_ENV):
        model.get_embedding_model()

    assert _SentenceTransformer.calls == []
