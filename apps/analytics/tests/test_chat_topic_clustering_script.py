from __future__ import annotations

import importlib
import sys
import types
from collections.abc import Iterator
from typing import cast

import pytest

_DATABASE_MODULES = ("src.db", "src.scripts.10_chat_topic_clustering")
_MISSING = object()


@pytest.fixture(autouse=True)
def isolate_database_modules() -> Iterator[None]:
    """Do not retain modules imported under a test-only DATABASE_URL."""
    previous = {name: sys.modules.get(name, _MISSING) for name in _DATABASE_MODULES}
    previous_parent_attributes = {}
    for name in _DATABASE_MODULES:
        parent_name, attribute = name.rsplit(".", 1)
        parent = sys.modules.get(parent_name)
        previous_parent_attributes[(parent_name, attribute)] = (
            getattr(parent, attribute, _MISSING) if parent is not None else _MISSING
        )
    yield
    for name, module in previous.items():
        if module is _MISSING:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = cast(types.ModuleType, module)
    for (parent_name, attribute), value in previous_parent_attributes.items():
        parent = sys.modules.get(parent_name)
        if parent is None:
            continue
        if value is _MISSING:
            if hasattr(parent, attribute):
                delattr(parent, attribute)
        else:
            setattr(parent, attribute, value)


class _Scalars:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _Scalars(self._rows)


class _Session:
    def __init__(self, rows):
        self._rows = rows
        self.rollback_count = 0

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def execute(self, _stmt):
        return _Result(self._rows)

    def rollback(self):
        self.rollback_count += 1


def test_chat_topic_clustering_reports_partial_failures(monkeypatch):
    cluster_module = types.ModuleType("src.modules.chat_topic_clustering.cluster_chatbot")
    cluster_module.cluster_chatbot = lambda *_args, **_kwargs: 0
    monkeypatch.setitem(
        sys.modules,
        "src.modules.chat_topic_clustering.cluster_chatbot",
        cluster_module,
    )
    sys.modules.pop("src.scripts.10_chat_topic_clustering", None)
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://localhost:5432/analytics",
    )
    module = importlib.import_module("src.scripts.10_chat_topic_clustering")
    session = _Session([type("Chatbot", (), {"id": "ok"})(), type("Chatbot", (), {"id": "broken"})()])
    clustered: list[str] = []

    monkeypatch.setattr(module, "SessionLocal", lambda: session)
    monkeypatch.setattr(module, "scoped_course_ids", lambda _session: None)
    monkeypatch.setattr(module, "script_entry", lambda **_kwargs: 0.0)
    monkeypatch.setattr(module, "script_exit", lambda **_kwargs: None)

    def cluster(_session, chatbot_id, *_args, **_kwargs):
        clustered.append(chatbot_id)
        if chatbot_id == "broken":
            raise RuntimeError("cluster failed")
        return 2

    monkeypatch.setattr(module, "cluster_chatbot", cluster)

    with pytest.raises(RuntimeError, match=r"1 of 2 chatbot clustering jobs failed.*broken"):
        module.main()

    assert clustered == ["ok", "broken"]
    assert session.rollback_count == 1
