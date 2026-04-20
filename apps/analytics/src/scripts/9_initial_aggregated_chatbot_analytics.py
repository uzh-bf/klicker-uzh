# AggregatedChatbotAnalytics rollup across DAILY / WEEKLY / MONTHLY / COURSE.
# Raw SQL in the aggregated_chat_analytics module does the aggregation; this
# script just iterates the date windows.

import sys

sys.path.append("../../")

from src.db import SessionLocal
from src.log import script_entry, script_exit
from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
    compute_aggregated_chatbot_analytics,
)
from src.modules.utils import (
    analytics_mode,
    analytics_window_since,
    iter_analytics_windows,
    scoped_course_ids,
)


def main() -> None:
    with SessionLocal() as session:
        scope = scoped_course_ids(session)
        window_since = analytics_window_since()
        started = script_entry(
            script=__name__,
            mode=analytics_mode(),
            scope_size=len(scope) if scope is not None else None,
            window_since=window_since,
        )

        iter_analytics_windows(
            session,
            compute_aggregated_chatbot_analytics,
            course_ids=scope,
            label="aggregated chatbot analytics",
            windows_since=window_since,
            verbose=False,
        )

        script_exit(script=__name__, started=started, rows_written=None)


if __name__ == "__main__":
    main()
