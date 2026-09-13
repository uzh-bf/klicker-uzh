from .get_participant_responses import get_participant_responses
from .compute_correctness import compute_correctness
from .aggregate_analytics import aggregate_analytics
from .save_participant_analytics import save_participant_analytics
from ..analytics_eligibility import AnalyticsEligibilityContext, ensure_analytics_eligibility


def compute_participant_analytics(
    db,
    start_date,
    end_date,
    timestamp,
    analytics_type="DAILY",
    verbose=False,
    eligibility: AnalyticsEligibilityContext | None = None,
):
    eligibility = ensure_analytics_eligibility(db, eligibility)
    df_details = get_participant_responses(db, start_date, end_date, verbose, eligibility)

    # Compute the correctness of each question response detail
    df_details, df_element_instances = compute_correctness(db, df_details, verbose)

    if df_details is None or df_details.empty:
        print(f"No participant responses found for {start_date} to {end_date}.")
        return

    # Compute participant analytics (score/xp counts and correctness statistics)
    df_analytics = aggregate_analytics(df_details)

    # Save the aggreagted analytics into the database
    save_participant_analytics(
        db,
        df_analytics,
        timestamp,
        analytics_type,
        eligibility,
        source_window_start=start_date,
        source_window_end=end_date,
    )

    # Delete the dataframes to avoid conflicts in the next iteration
    del df_details
    del df_element_instances
    del df_analytics
