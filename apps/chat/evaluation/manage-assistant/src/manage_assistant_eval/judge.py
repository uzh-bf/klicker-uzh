"""Judge-model wiring for the E3/E4-quality/E7-assistant-message DeepEval `GEval`
checks (see tests/test_e3_grounding.py, test_e4_proposal_quality.py,
test_e7_degradation.py).

The judge credential (`MANAGE_ASSISTANT_EVAL_JUDGE_*`) is deliberately separate
from the app-under-test's `OPENAI_API_KEY`/`OPENAI_BASE_URL`, which point the
model being evaluated at the local litellm gateway. DeepEval ships two
OpenAI-SDK-shaped model wrappers: `LiteLLMModel` (arbitrary model names, but
requires the separate `litellm` package) and `GPTModel` (the smaller wrapper
that only needs the `openai` package, already installed transitively via
`deepeval`). DeepEval 4.1.5's `GPTModel` accepts arbitrary OpenAI-compatible
model identifiers through its generic model-data fallback, so the judge can
use the real `gpt-5.6-luna` name without a compatibility alias or an additional
dependency. `judge_api_base` still points the OpenAI-SDK client at a compatible
gateway (the disposable local litellm instance in the live procedure).

For an unknown model identifier, DeepEval marks log-probability support as
unknown. `GEval` consequently takes its structured-output fallback instead of
calling `generate_raw_response` with `logprobs`/`top_logprobs`, which is
compatible with the GPT-5.6 Luna reasoning endpoint. GPT-5-family endpoints
require `temperature=1`, so `build_judge_model` selects that value for those
names while retaining deterministic `temperature=0` for models that support
it.
"""

from __future__ import annotations

from .config import Settings

# DeepEval 4.1.5 accepts arbitrary OpenAI-compatible model identifiers and
# supplies generic model metadata for names it does not know. Keep this hint
# short and truthful because the gateway may expose a deployment alias.
SUPPORTED_JUDGE_MODELS_HINT = (
    "an OpenAI-compatible model identifier, e.g. 'gpt-5.6-luna' or "
    "'gpt-5.4' (DeepEval 4.1.5 accepts custom identifiers)"
)


def judge_unavailable_reason(settings: Settings) -> str | None:
    """Returns a human-readable reason the judge cannot run, or None when
    it's configured. Every judge-based test must check this FIRST and
    `pytest.skip(reason)` -- never silently pass, never call the judge with
    a missing credential (which would otherwise surface as an opaque auth
    error deep inside the openai SDK instead of a clear skip)."""
    if not settings.judge_model:
        return (
            "MANAGE_ASSISTANT_EVAL_JUDGE_MODEL is not set -- no judge model "
            f"configured. Set it to {SUPPORTED_JUDGE_MODELS_HINT}."
        )
    if not settings.judge_api_key:
        return (
            "MANAGE_ASSISTANT_EVAL_JUDGE_API_KEY is not set -- the judge "
            "model has no credential to call."
        )
    return None


def build_judge_model(settings: Settings):
    """Construct the `DeepEvalBaseLLM` instance for `GEval(model=...)`.

    Callers MUST check `judge_unavailable_reason(settings) is None` (or
    `settings.judge_configured`) first. This function is not the skip gate.
    """
    from deepeval.models import GPTModel

    model_name = (settings.judge_model or "").lower()
    temperature = 1 if model_name.startswith(("gpt-5", "o1", "o3", "o4")) else 0

    return GPTModel(
        model=settings.judge_model,
        api_key=settings.judge_api_key,
        base_url=settings.judge_api_base,
        temperature=temperature,
    )
