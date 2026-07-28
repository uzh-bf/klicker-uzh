"""Judge-model wiring for the E3/E4-quality/E7-assistant-message DeepEval `GEval`
checks (see tests/test_e3_grounding.py, test_e4_proposal_quality.py,
test_e7_degradation.py).

Design note (why `GPTModel`, not DeepEval's bundled `LiteLLMModel`): this
harness's judge credential is deliberately separate from the app-under-test's
own `OPENAI_API_KEY`/`OPENAI_BASE_URL` (which point the *model being
evaluated* at the local litellm gateway, see apps/chat/src/app/api/manage/chat
/route.ts) -- gating the judge on its own env vars keeps "is the judge
configured" independent of "is the app's model configured". DeepEval ships
two OpenAI-SDK-shaped model wrappers: `LiteLLMModel` (arbitrary model names,
but requires the separate `litellm` package -- not installed here, and it
pulls in ~15 transitive packages including tokenizers/huggingface-hub for a
capability this harness does not need) and `GPTModel` (validates the model
name against DeepEval's own fixed OpenAI model list, but only needs the
`openai` package, already installed transitively via `deepeval` itself).
Given the no-new-dependency-unless-required repo convention, `GPTModel` is
the right default: `judge_api_base` can still point its OpenAI-SDK client at
a compatible gateway (e.g. this repo's own litellm instance, using a
`model_name` alias the gateway maps to whatever upstream you actually want to
judge with) without adding a dependency. If a future need genuinely requires
an arbitrary (non-OpenAI-list) model name, swap this module's
`build_judge_model` to `LiteLLMModel` and add `litellm` to pyproject.toml
then -- do not add the dependency speculatively.

Known residual, live-only risk (documented, not fixed here — the suite DOES
make live judge calls whenever a judge is configured, but no such run has
been executed yet against a real gateway, so this path is code-reviewed
rather than exercised): `GEval`
requests OpenAI `logprobs`/`top_logprobs` for models `GPTModel` believes
support them (`no_log_prob_support`, deepeval/metrics/g_eval/utils.py). If
`judge_api_base` points at a gateway that does not faithfully proxy logprobs
for the chosen model name, a live GEval call could error. Pick a
`MANAGE_ASSISTANT_EVAL_JUDGE_MODEL` value in DeepEval's
`unsupported_log_probs_gpt_models` list (e.g. an `o1`/`o3`-family name) to
force DeepEval's own no-logprob fallback path if this bites.
"""

from __future__ import annotations

from .config import Settings

# DeepEval's own fixed allow-list this harness's judge model name must be a
# member of (deepeval/models/llms/openai_model.py::valid_gpt_models). Mirrored
# here only for the README/error message -- GPTModel itself is the source of
# truth and raises ValueError on anything else.
SUPPORTED_JUDGE_MODELS_HINT = (
    "one of DeepEval's supported OpenAI-SDK model names, e.g. 'gpt-4o-mini', "
    "'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini' (see deepeval/models/llms/"
    "openai_model.py::valid_gpt_models for the exact list)"
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
    """Constructs the `DeepEvalBaseLLM` instance for `GEval(model=...)`.
    Callers MUST check `judge_unavailable_reason(settings) is None` (or
    `settings.judge_configured`) first -- this raises ValueError from
    `GPTModel` itself if `judge_model` is unset or not in its allow-list, and
    that is deliberately a hard error here (a test that got this far should
    already know the judge is configured; this function is not the skip
    gate)."""
    from deepeval.models import GPTModel

    return GPTModel(
        model=settings.judge_model,
        _openai_api_key=settings.judge_api_key,
        base_url=settings.judge_api_base,
        temperature=0,
    )
