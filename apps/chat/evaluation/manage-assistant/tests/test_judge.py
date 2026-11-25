"""Offline contracts for DeepEval judge-model compatibility."""

from __future__ import annotations

import pytest

from manage_assistant_eval.config import Settings
from manage_assistant_eval.judge import build_judge_model

pytestmark = pytest.mark.offline


def _settings(model: str) -> Settings:
    return Settings(
        chat_base_url="http://localhost:3004",
        ca_bundle=None,
        app_secret="abcd",
        database_url="host=localhost",
        lecturer_sub="lecturer",
        judge_model=model,
        judge_api_key="dummy",
        judge_api_base="http://127.0.0.1:14001/v1",
    )


@pytest.mark.parametrize("model", ["gpt-5.6-luna", "gpt-5.4", "o3-mini"])
def test_reasoning_model_uses_supported_temperature(model: str) -> None:
    judge = build_judge_model(_settings(model))

    assert judge.temperature == 1


def test_custom_model_uses_structured_geval_fallback() -> None:
    from deepeval.metrics.g_eval.utils import no_log_prob_support

    judge = build_judge_model(_settings("gpt-5.6-luna"))

    assert no_log_prob_support(judge)
