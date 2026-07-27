"""Environment configuration for the manage-assistant eval harness.

Every value has a dev-fixture default matching `.devcontainer/devcontainer.env`
(a committed, public, dev-only fixture — see that file and the repo CLAUDE.md
data-hygiene notes). Override any of these via env vars for a different
devrouter workspace, a primary checkout, or CI.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
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
    app_secret: str
    database_url: str
    lecturer_sub: str

    @property
    def chat_endpoint(self) -> str:
        return f"{self.chat_base_url.rstrip('/')}/api/manage/chat"


def load_settings() -> Settings:
    """Reads harness configuration from the environment.

    Env vars (see README for the full list): KLICKER_CHAT_BASE_URL,
    KLICKER_CA_BUNDLE, APP_SECRET, DATABASE_URL, KLICKER_LECTURER_SUB.
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
    )
