from collections.abc import Callable
from typing import ContextManager

from sqlalchemy.orm import Session

from src.log import script_entry, script_exit
from src.modules.live_quiz_analytics.compute_live_quiz_analytics import (
    compute_aggregated_live_quiz_analytics,
    compute_participant_live_quiz_analytics,
)
from src.modules.utils import AnalyticsRunConfig, scoped_course_ids

SCRIPT_NAME = "src.scripts.14_live_quiz_assessment_analytics"
SessionFactory = Callable[[], ContextManager[Session]]


def run_live_quiz_analytics(
    config: AnalyticsRunConfig,
    *,
    session_factory: SessionFactory | None = None,
) -> None:
    """Run live-quiz analytics directly with immutable per-task configuration."""
    if session_factory is None:
        from src.db import SessionLocal

        session_factory = SessionLocal

    with session_factory() as session:
        scope = scoped_course_ids(session, config)
        started = script_entry(
            script=SCRIPT_NAME,
            mode=config.mode,
            scope_size=len(scope) if scope is not None else None,
            window_since=config.window_since,
        )

        if scope is not None and not scope:
            print("[14_live_quiz_assessment_analytics] empty course scope — skipping live quiz analytics")
            script_exit(script=SCRIPT_NAME, started=started, rows_written=0)
            return

        print("Computing ParticipantLiveQuizAnalytics (assessment-mode only)")
        compute_participant_live_quiz_analytics(session, course_ids=scope, verbose=True)

        print("Computing AggregatedLiveQuizAnalytics (assessment-mode only)")
        compute_aggregated_live_quiz_analytics(session, course_ids=scope, verbose=True)

        script_exit(script=SCRIPT_NAME, started=started, rows_written=None)
