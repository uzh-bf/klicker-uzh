"""Environment configuration for the manage-assistant eval harness.

Every value has a dev-fixture default matching `.devcontainer/devcontainer.env`
(a committed, public, dev-only fixture — see that file and the repo CLAUDE.md
data-hygiene notes). Override any of these via env vars for a different
devrouter workspace, a primary checkout, or CI.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass, field
from functools import lru_cache

# The lecturer/Manage session cookie name verified by
# apps/chat/src/lib/server/manageAuth.ts.
SESSION_COOKIE_NAME = "next-auth.session-token"

# Seeded delegated-login lecturer (shortname "lecturer", role ADMIN) — see
# CLAUDE.md "Test credentials" and confirmed live against the seeded DB.
DEFAULT_LECTURER_SUB = "76047345-3801-4628-ae7b-adbebcfe8821"

# Stable prefix used to mark every DB row this harness's seed step creates,
# so seeding stays additive/idempotent and never touches unrelated rows.
EVAL_SEED_PREFIX = "eval-manage-assistant"


@lru_cache(maxsize=1)
def _mkcert_caroot() -> str | None:
    try:
        result = subprocess.run(
            ["mkcert", "-CAROOT"], capture_output=True, text=True, timeout=5, check=True
        )
    except (OSError, subprocess.SubprocessError):
        return None
    caroot = result.stdout.strip()
    return caroot or None


@dataclass(frozen=True)
class Settings:
    chat_base_url: str
    ca_bundle: str | None
    # `repr=False` on every secret-bearing field, because this frozen dataclass
    # is a pytest FIXTURE and pytest prints the full repr of every fixture value
    # in the failure header of any failing test. Without it, a single failing
    # judge-based case emits the judge API key and the DB password (with its
    # password= component) straight into the nightly CI log. GitHub Actions
    # masks registered `secrets.*` values, but that is the last line of defense,
    # not the only one: a local run pointed at a non-dev database, or a failure
    # header pasted into a PR comment, gets no masking at all.
    app_secret: str = field(repr=False)
    database_url: str = field(repr=False)
    lecturer_sub: str
    # Judge model config for the E3/E4-quality/E7-assistant-message GEval checks (see
    # judge.py). Deliberately a SEPARATE credential namespace from the app's
    # own OPENAI_API_KEY/OPENAI_BASE_URL (which point the model UNDER TEST at
    # the litellm gateway) -- the judge is a different concern and this
    # harness must be able to gate on its own credential independently of
    # whatever the live app's model key is doing. `judge_model` is an
    # OpenAI-compatible model identifier (DeepEval 4.1.5 accepts custom names;
    # see judge.py / README); `judge_api_base` optionally points that
    # OpenAI-SDK-shaped call at a compatible gateway instead of api.openai.com.
    judge_model: str | None
    judge_api_key: str | None = field(repr=False)
    judge_api_base: str | None

    @property
    def chat_endpoint(self) -> str:
        return f"{self.chat_base_url.rstrip('/')}/api/manage/chat"

    @property
    def judge_configured(self) -> bool:
        """True only when both a judge model name AND a credential are set.
        Every judge-based check (E3 grounding, E4 proposal quality, E7
        assistant-message) must gate on this and skip -- never silently pass
        -- when it is False. `judge_api_base` is optional (defaults to
        OpenAI's own endpoint)."""
        return bool(self.judge_model) and bool(self.judge_api_key)


def load_settings() -> Settings:
    """Reads harness configuration from the environment.

    Env vars (see README for the full list): KLICKER_CHAT_BASE_URL,
    KLICKER_CA_BUNDLE, APP_SECRET, DATABASE_URL, KLICKER_LECTURER_SUB,
    MANAGE_ASSISTANT_EVAL_JUDGE_MODEL, MANAGE_ASSISTANT_EVAL_JUDGE_API_KEY,
    MANAGE_ASSISTANT_EVAL_JUDGE_API_BASE.
    """
    ca_bundle = os.environ.get("KLICKER_CA_BUNDLE")
    if not ca_bundle:
        caroot = _mkcert_caroot()
        ca_bundle = f"{caroot}/rootCA.pem" if caroot else None

    return Settings(
        chat_base_url=os.environ.get("KLICKER_CHAT_BASE_URL", "http://localhost:3004"),
        ca_bundle=ca_bundle,
        # Dev fixture, matches .devcontainer/devcontainer.env APP_SECRET=abcd.
        app_secret=os.environ.get("APP_SECRET", "abcd"),
        # Dev fixture host-side DSN for the primary checkout; override for a
        # linked worktree (db.klicker.<workspace>.localhost) or CI. Password
        # "klicker" / user "klicker-prod" already ship in
        # .devcontainer/devcontainer.env's in-container DATABASE_URL.
        database_url=os.environ.get(
            "DATABASE_URL",
            "host=db.klicker.localhost port=5432 dbname=klicker-prod "
            "user=klicker-prod password=klicker sslmode=require sslnegotiation=direct",
        ),
        lecturer_sub=os.environ.get("KLICKER_LECTURER_SUB", DEFAULT_LECTURER_SUB),
        judge_model=os.environ.get("MANAGE_ASSISTANT_EVAL_JUDGE_MODEL"),
        judge_api_key=os.environ.get("MANAGE_ASSISTANT_EVAL_JUDGE_API_KEY"),
        judge_api_base=os.environ.get("MANAGE_ASSISTANT_EVAL_JUDGE_API_BASE"),
    )
