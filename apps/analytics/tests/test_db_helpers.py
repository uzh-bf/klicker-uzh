from __future__ import annotations

import os
import sys
from datetime import date, datetime, timedelta, timezone

import pandas as pd
import pytest
from sqlalchemy import Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, load_only, mapped_column

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.db_helpers import (
    bulk_upsert,
    coerce_date,
    coerce_timestamp,
    row_to_dict,
    utcnow,
)


class _Base(DeclarativeBase):
    pass


class _Thing(_Base):
    __tablename__ = "thing"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    legacy: Mapped[str] = mapped_column(String)


def test_row_to_dict_skips_unloaded_column_attributes():
    engine = create_engine("sqlite:///:memory:")
    _Base.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(_Thing(id=1, name="visible", legacy="hidden"))
        session.commit()

    with Session(engine) as session:
        thing = session.execute(select(_Thing).options(load_only(_Thing.id, _Thing.name))).scalar_one()

        assert row_to_dict(thing) == {"id": 1, "name": "visible"}


def test_coerce_date_accepts_iso_string_and_datetime():
    assert coerce_date("1970-01-01") == date(1970, 1, 1)
    assert coerce_date("2026-02-15T00:00:00.000Z") == date(2026, 2, 15)
    assert coerce_date(datetime(2026, 4, 20, 13, 45, 0)) == date(2026, 4, 20)
    assert coerce_date(pd.Timestamp("2026-04-20T13:45:00Z")) == date(2026, 4, 20)


def test_coerce_timestamp_normalizes_iso_z_and_mixed_awareness_to_utc_naive():
    aware_string = coerce_timestamp("2026-02-15T00:00:00.000Z")
    naive_dt = coerce_timestamp(datetime(2026, 2, 15, 0, 0, 0))
    aware_pd = coerce_timestamp(pd.Timestamp("2026-02-15T02:00:00+02:00"))

    assert aware_string == datetime(2026, 2, 15, 0, 0, 0)
    assert naive_dt == datetime(2026, 2, 15, 0, 0, 0)
    assert aware_pd == datetime(2026, 2, 15, 0, 0, 0)
    assert aware_string.tzinfo is None
    assert aware_pd.tzinfo is None


def test_coerce_date_rejects_non_date_strings():
    try:
        coerce_date("not-a-date")
    except ValueError:
        pass
    else:
        raise AssertionError("expected invalid date string to raise ValueError")


def test_bulk_upsert_rejects_rows_with_different_columns():
    rows = [
        {"id": 1, "name": "complete", "legacy": "present"},
        {"id": 2, "name": "missing-legacy"},
    ]

    with pytest.raises(ValueError, match=r"row 1.*same columns"):
        bulk_upsert(
            session=None,  # type: ignore[arg-type]
            Model=_Thing,
            rows=rows,
            conflict_cols=["id"],
        )


def test_utcnow_is_naive_utc():
    before = datetime.now(timezone.utc).replace(tzinfo=None)
    result = utcnow()
    after = datetime.now(timezone.utc).replace(tzinfo=None)

    assert result.tzinfo is None
    assert before - timedelta(seconds=1) <= result <= after + timedelta(seconds=1)
