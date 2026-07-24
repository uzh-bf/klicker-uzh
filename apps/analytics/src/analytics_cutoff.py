from datetime import datetime, timedelta, timezone

DATABASE_TIMESTAMP_RESOLUTION = timedelta(milliseconds=1)


def database_safe_cutoff(created_at: datetime) -> str:
    """Return a conservative UTC cutoff for PostgreSQL TIMESTAMP(3) columns."""
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    utc_created_at = created_at.astimezone(timezone.utc)
    millisecond_floor = utc_created_at.replace(microsecond=(utc_created_at.microsecond // 1000) * 1000)
    conservative_cutoff = millisecond_floor - DATABASE_TIMESTAMP_RESOLUTION
    return conservative_cutoff.isoformat(timespec="milliseconds")


if __name__ == "__main__":
    print(database_safe_cutoff(datetime.now(timezone.utc)))
