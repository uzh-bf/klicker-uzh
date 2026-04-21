"""Unit tests for the dry-run interceptors.

These tests avoid the database entirely — they exercise the text-SQL
classification helpers, the INSERT-to-SELECT rewrite, and the bulk-upsert
short-circuit through a direct call to the patched function.
"""

from __future__ import annotations

import os
import sys
from datetime import date
import xml.etree.ElementTree as ET
import zipfile

import pytest
from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.dryrun.interceptor import (  # noqa: E402
    CaptureBuffer,
    _value_preview,
    classify_text,
    intercept_writes,
    remap_result_rows,
    rewrite_insert_to_select,
)


class _FakeModel:
    __tablename__ = "ParticipantAnalytics"


def test_classify_text_detects_plain_insert():
    verb, table = classify_text('INSERT INTO "ParticipantAnalytics" (id) VALUES (1)')
    assert verb == "INSERT"
    assert table == "ParticipantAnalytics"


def test_classify_text_detects_insert_with_leading_cte():
    sql = """
    WITH chat_course AS (SELECT 1)
    INSERT INTO "ParticipantChatOutcome" ("participantId") SELECT 1
    ON CONFLICT DO NOTHING
    """
    verb, table = classify_text(sql)
    assert verb == "INSERT"
    assert table == "ParticipantChatOutcome"


def test_classify_text_detects_update_with_leading_cte():
    sql = """
    WITH quiz_courses AS (SELECT 1)
    UPDATE "Course" c SET "areAnalyticsValid" = true
    WHERE EXISTS (SELECT 1 FROM quiz_courses);
    """
    verb, table = classify_text(sql)
    assert verb == "UPDATE"
    assert table == "Course"


def test_classify_text_detects_delete():
    verb, table = classify_text('DELETE FROM "ChatTopicCluster" WHERE id = 1')
    assert verb == "DELETE"
    assert table == "ChatTopicCluster"


def test_classify_text_passes_select_through():
    verb, table = classify_text('SELECT COUNT(*) FROM "Course"')
    assert verb == "SELECT"
    assert table is None


def test_classify_text_ignores_dml_keyword_in_comment():
    # A ``-- INSERT INTO "X"`` banner must not flip the classification.
    sql = '-- INSERT INTO "Course" (id) VALUES (1)\nSELECT 1'
    verb, _ = classify_text(sql)
    assert verb == "SELECT"


def test_rewrite_insert_to_select_strips_cols_and_on_conflict():
    sql = (
        'INSERT INTO "ParticipantAnalytics" ("courseId", "timestamp")\n'
        "SELECT id, NOW() FROM other\n"
        'ON CONFLICT ("courseId", "timestamp") DO UPDATE SET "timestamp" = NOW()'
    )
    result = rewrite_insert_to_select(sql)
    assert result is not None
    table, columns, rewritten = result
    assert table == "ParticipantAnalytics"
    assert columns == ["courseId", "timestamp"]
    assert rewritten.upper().startswith("SELECT")
    assert "ON CONFLICT" not in rewritten.upper()


def test_rewrite_insert_to_select_preserves_leading_cte():
    sql = (
        "WITH cuts AS (SELECT 1 AS c)\n"
        'INSERT INTO "ParticipantChatOutcome" ("participantId") SELECT c FROM cuts\n'
        "ON CONFLICT DO NOTHING"
    )
    result = rewrite_insert_to_select(sql)
    assert result is not None
    _, columns, rewritten = result
    assert columns == ["participantId"]
    assert rewritten.upper().startswith("WITH CUTS")
    assert "SELECT C FROM CUTS" in rewritten.upper()


def test_rewrite_insert_to_select_values_payload_stays_valid():
    sql = 'INSERT INTO "ChatTopicCluster" ("type") VALUES (:analytics_type)'
    result = rewrite_insert_to_select(sql)
    assert result is not None
    _, columns, rewritten = result
    assert columns == ["type"]
    # Bare ``VALUES (:param)`` is a row source that Postgres will happily execute
    # as a read. The rewrite keeps the placeholder intact for param binding.
    assert rewritten.upper().startswith("VALUES")
    assert ":analytics_type" in rewritten


def test_rewrite_insert_to_select_returns_none_for_non_insert():
    assert rewrite_insert_to_select('SELECT 1 FROM "Course"') is None


def test_remap_result_rows_uses_target_columns_for_unaliased_selects():
    rows = remap_result_rows(
        ["type", "timestamp", "chatbotId", "newParticipants"],
        [("COURSE", "1970-01-01", "cb-1", 0)],
    )
    assert rows == [
        {
            "type": "COURSE",
            "timestamp": "1970-01-01",
            "chatbotId": "cb-1",
            "newParticipants": 0,
        }
    ]


def test_remap_result_rows_rejects_column_count_mismatches():
    with pytest.raises(ValueError, match="expected 3 columns, got 2"):
        remap_result_rows(["a", "b", "c"], [(1, 2)])


def test_value_preview_handles_plain_dates():
    assert _value_preview(date(2026, 4, 20)) == "2026-04-20"


def test_bulk_upsert_patch_captures_rows_without_db():
    import src.db_helpers as db_helpers

    buffer = CaptureBuffer()
    rows = [
        {"courseId": "a", "timestamp": "t1", "score": 1},
        {"courseId": "b", "timestamp": "t2", "score": 2},
    ]

    original = db_helpers.bulk_upsert
    with intercept_writes(buffer):
        # ``bulk_upsert`` is now the capturing variant; calling it must never
        # hit a DB and must report the number of rows recorded.
        written = db_helpers.bulk_upsert(
            session=None,
            Model=_FakeModel,
            rows=rows,
            conflict_cols=["courseId", "timestamp"],
        )

    assert written == 2
    assert buffer.rows_by_table["ParticipantAnalytics"] == rows
    # Patches are restored cleanly on exit.
    assert db_helpers.bulk_upsert is original


def test_bulk_upsert_patch_handles_empty_rows():
    import src.db_helpers as db_helpers

    buffer = CaptureBuffer()
    with intercept_writes(buffer):
        written = db_helpers.bulk_upsert(
            session=None,
            Model=_FakeModel,
            rows=[],
            conflict_cols=["courseId"],
        )

    assert written == 0
    assert "ParticipantAnalytics" not in buffer.rows_by_table


def test_intercept_writes_rebinds_already_imported_consumers():
    # Modules that did ``from src.db_helpers import bulk_upsert`` before the
    # interceptor was installed must still route through the capturing
    # variant — the interceptor walks sys.modules to patch them up.
    import importlib

    import src.db_helpers as db_helpers

    save_mod = importlib.import_module(
        "src.modules.participant_analytics.save_participant_analytics"
    )
    buffer = CaptureBuffer()
    original = db_helpers.bulk_upsert

    assert save_mod.bulk_upsert is original

    with intercept_writes(buffer):
        assert save_mod.bulk_upsert is not original
        written = save_mod.bulk_upsert(
            session=None,
            Model=_FakeModel,
            rows=[{"a": 1}],
            conflict_cols=["a"],
        )
        assert written == 1

    assert save_mod.bulk_upsert is original


def test_intercept_writes_noops_commit_and_flush():
    from sqlalchemy.orm import Session

    buffer = CaptureBuffer()
    commit_before = Session.commit
    flush_before = Session.flush

    with intercept_writes(buffer):
        assert Session.commit is not commit_before
        assert Session.flush is not flush_before

        # Build a stub that looks enough like a Session to call the patched
        # methods — noop_commit / noop_flush only take self.
        class _Stub:
            pass

        stub = _Stub()
        # Bind the patched bound methods dynamically.
        Session.commit(stub)  # type: ignore[arg-type]
        Session.flush(stub)  # type: ignore[arg-type]

    assert Session.commit is commit_before
    assert Session.flush is flush_before


@pytest.mark.parametrize("verb", ["UPDATE", "DELETE"])
def test_skipped_writes_capture_verb_and_sql(verb):
    buffer = CaptureBuffer()
    sql = (
        f'{verb} FROM "Course" WHERE id = 1'
        if verb == "DELETE"
        else f'{verb} "Course" SET x = 1'
    )
    buffer.skip(f"{verb}-TEXT", sql, {"x": 1})
    entry = buffer.skipped_writes[-1]
    assert entry["verb"] == f"{verb}-TEXT"
    assert entry["sql"] == sql
    assert "x" in entry["params"]


def test_capture_buffer_coerces_non_primitive_values():
    buffer = CaptureBuffer()

    class _Custom:
        def __repr__(self) -> str:
            return "<custom>"

    buffer.record("X", [{"a": _Custom(), "b": 3}])
    assert buffer.rows_by_table["X"][0]["a"] == "<custom>"
    assert buffer.rows_by_table["X"][0]["b"] == 3


def test_capture_buffer_strips_tzinfo_from_datetimes():
    # xlsxwriter rejects timezone-aware datetimes. Captured rows should be
    # written with tzinfo removed (values normalised to UTC first), so the
    # workbook round-trips cleanly through pandas' Excel writer.
    from datetime import datetime, timezone, timedelta

    buffer = CaptureBuffer()
    aware_utc = datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc)
    aware_plus2 = datetime(2026, 4, 20, 14, 0, tzinfo=timezone(timedelta(hours=2)))
    naive = datetime(2026, 4, 20, 9, 0)

    buffer.record(
        "X",
        [{"utc": aware_utc, "plus2": aware_plus2, "naive": naive}],
    )
    row = buffer.rows_by_table["X"][0]
    assert row["utc"].tzinfo is None
    assert row["plus2"].tzinfo is None
    # +02:00 at 14:00 local == 12:00 UTC
    assert row["plus2"] == datetime(2026, 4, 20, 12, 0)
    assert row["naive"] == naive


def test_write_excel_produces_xlsx_with_expected_sheets(tmp_path):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record("ParticipantAnalytics", [{"id": 1}])
    buffer.mark_table(
        "AggregatedLiveQuizAnalytics",
        columns=["liveQuizId", "participantCount"],
        status="empty",
        note="script ran but wrote zero rows",
    )
    buffer.skip("UPDATE-TEXT", 'UPDATE "Course" SET x = 1', None)
    buffer.record_script(
        "src.scripts.0_initial_participant_analytics",
        0.12,
        rows_written=1,
        status="produced",
    )

    output = tmp_path / "out.xlsx"
    write_excel(buffer, output, {"course_id": "test", "run_at": "2026-04-20"})

    assert output.exists() and output.stat().st_size > 0
    workbook = _workbook_xml(output)
    expected_order = [
        "00 Run Health",
        "01 Index",
        "10 Activity",
        "11 Performance",
        "12 Chat",
        "13 Live Quiz",
        "14 Platform",
        "90 Raw - ParticipantAnalytics",
        "90 Raw - AggregatedLiveQuizAnal",
        "99 Diagnostics",
    ]
    assert _sheet_names(workbook)[: len(expected_order)] == expected_order

    raw_sheet = _sheet_xml(output, "90 Raw - ParticipantAnalytics")
    pane = raw_sheet.find(".//main:pane", _NS)
    assert pane is not None
    assert pane.attrib.get("state") == "frozen"
    assert raw_sheet.find(".//main:autoFilter", _NS) is not None
    table_parts = raw_sheet.find(".//main:tableParts", _NS)
    assert table_parts is not None
    assert table_parts.attrib.get("count") == "1"

    empty_sheet_values = _sheet_values(output, "90 Raw - AggregatedLiveQuizAnal")
    assert (
        "No rows captured for this table in the selected dry run."
        in empty_sheet_values.values()
    )
    assert "liveQuizId" in empty_sheet_values.values()
    assert "participantCount" in empty_sheet_values.values()
    assert _sheet_state(workbook, "13 Live Quiz") == "hidden"
    assert _sheet_state(workbook, "90 Raw - AggregatedLiveQuizAnal") == "hidden"

    index_values = _sheet_values(output, "01 Index")
    assert "13 Live Quiz" not in index_values.values()
    assert "90 Raw - AggregatedLiveQuizAnal" not in index_values.values()

    diagnostics_values = _sheet_values(output, "99 Diagnostics")
    assert "UPDATE-TEXT" in diagnostics_values.values()


def test_intercept_writes_rolls_back_failed_rewrite_before_next_query(monkeypatch):
    from sqlalchemy.orm import Session

    class _Stub:
        def __init__(self) -> None:
            self.rollback_calls = 0
            self.tx_aborted = False

        def rollback(self) -> None:
            self.rollback_calls += 1
            self.tx_aborted = False

    def fake_execute(self, statement, params=None, **kwargs):
        sql = str(statement)
        if "missing_source" in sql:
            self.tx_aborted = True
            raise RuntimeError("boom")
        if self.tx_aborted:
            raise RuntimeError("transaction still aborted")
        return [("ok",)]

    monkeypatch.setattr(Session, "execute", fake_execute)

    buffer = CaptureBuffer()
    stub = _Stub()
    with intercept_writes(buffer):
        Session.execute(
            stub,
            text('INSERT INTO "X" ("value") SELECT value FROM missing_source'),
        )
        result = Session.execute(
            stub,
            text('INSERT INTO "X" ("value") VALUES (\'ok\')'),
        )

    assert stub.rollback_calls == 1
    assert result.rowcount == 1
    assert buffer.rows_by_table["X"] == [{"value": "ok"}]


def test_write_excel_index_links_do_not_overwrite_table_header(tmp_path):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record("ParticipantAnalytics", [{"id": 1}])

    output = tmp_path / "index.xlsx"
    write_excel(buffer, output, {"course_id": "test", "scope_mode": "course"})

    index_values = _sheet_values(output, "01 Index")
    assert index_values["A6"] == "sheet"
    assert index_values["B6"] == "kind"
    assert index_values["C6"] == "description"
    assert index_values["A7"] == "00 Run Health"
    assert index_values["B7"] == "Summary"


def test_write_excel_deduplicates_diagnostics_and_keeps_raw_sheets_data_only(tmp_path):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record(
        "ChatTopicCluster",
        [{"type": "COURSE", "clusterIndex": 0, "clusterLabel": "topic"}],
    )
    buffer.skip(
        "DELETE-TEXT",
        'DELETE FROM "ChatTopicCluster" WHERE "type" = \'COURSE\'',
        None,
        table="ChatTopicCluster",
    )
    for _ in range(2):
        buffer.skip(
            "INSERT-TEXT (rewrite failed: boom)",
            'INSERT INTO "ParticipantChatAnalytics" ("type") VALUES (\'COURSE\')',
            {"type": "COURSE"},
            table="ParticipantChatAnalytics",
            note="boom",
        )

    output = tmp_path / "dedup.xlsx"
    write_excel(buffer, output, {"course_id": "test"})

    raw_values = _sheet_values(output, "90 Raw - ChatTopicCluster")
    assert "DELETE-TEXT" not in raw_values.values()

    diagnostics_values = _sheet_values(output, "99 Diagnostics")
    assert "count" in diagnostics_values.values()
    assert "2" in diagnostics_values.values()


def test_write_excel_sanitizes_nan_and_inf_values(tmp_path):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record(
        "ParticipantPerformance",
        [
            {
                "participantId": "p1",
                "totalErrorRate": float("nan"),
                "firstErrorRate": float("inf"),
                "lastErrorRate": float("-inf"),
                "totalPerformance": "MEDIUM",
            }
        ],
    )
    buffer.record(
        "ParticipantAnalytics",
        [{"id": 1, "responseCount": float("nan")}],
    )

    output = tmp_path / "nan.xlsx"
    write_excel(buffer, output, {"course_id": "test"})

    assert output.exists() and output.stat().st_size > 0
    workbook = _workbook_xml(output)
    assert "11 Performance" in _sheet_names(workbook)
    assert "90 Raw - ParticipantAnalytics" in _sheet_names(workbook)


def test_write_excel_summary_sheets_do_not_add_sheet_level_autofilter(tmp_path):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record(
        "AggregatedAnalytics",
        [
            {"type": "WEEKLY", "timestamp": "2026-04-20", "participantCount": 10},
            {"type": "DAILY", "timestamp": "2026-04-20", "participantCount": 4},
        ],
    )
    buffer.record(
        "ParticipantCourseAnalytics",
        [
            {
                "participantId": "p1",
                "activeWeeks": 3,
                "activeDaysPerWeek": 1.5,
                "meanElementsPerDay": 2.0,
                "activityLevel": "HIGH",
            }
        ],
    )
    buffer.record(
        "AggregatedCourseAnalytics",
        [
            {
                "courseId": "c1",
                "courseParticipantCount": 1,
                "activityMonday": 1.0,
                "activityTuesday": 0.0,
                "activityWednesday": 0.0,
                "activityThursday": 0.0,
                "activityFriday": 0.0,
                "activitySaturday": 0.0,
                "activitySunday": 0.0,
            }
        ],
    )

    output = tmp_path / "summary-autofilter.xlsx"
    write_excel(buffer, output, {"course_id": "test"})

    activity_sheet = _sheet_xml(output, "10 Activity")
    assert activity_sheet.find("./main:autoFilter", _NS) is None
    table_parts = activity_sheet.find("./main:tableParts", _NS)
    assert table_parts is not None
    assert int(table_parts.attrib.get("count", "0")) > 1


def test_write_excel_formats_summary_and_raw_timestamp_cells_as_dates(tmp_path):
    from datetime import datetime

    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record(
        "AggregatedChatbotAnalytics",
        [
            {
                "type": "DAILY",
                "timestamp": date(2026, 4, 20),
                "chatbotId": "cb-1",
                "courseId": "course-1",
                "activeParticipants": 1,
                "newParticipants": 0,
                "returningParticipants": 0,
                "threads": 1,
                "userMessages": 1,
                "assistantMessages": 1,
                "creditExhaustionRate": 0.0,
            }
        ],
    )
    buffer.record(
        "ChatTopicCluster",
        [
            {
                "type": "COURSE",
                "timestamp": date(2026, 4, 20),
                "chatbotId": "cb-1",
                "clusterIndex": 0,
                "clusterLabel": "topic",
                "messageCount": 1,
                "participantCount": 1,
                "representativeParaphrase": None,
                "embeddingCentroid": None,
                "createdAt": datetime(2026, 4, 20, 12, 0, 0),
            }
        ],
    )

    output = tmp_path / "date-format.xlsx"
    write_excel(buffer, output, {"course_id": "test"})

    assert _cell_number_format(output, "12 Chat", "B7") == "yyyy-mm-dd"
    assert (
        _cell_number_format(output, "90 Raw - ChatTopicCluster", "B5") == "yyyy-mm-dd"
    )
    assert (
        _cell_number_format(output, "90 Raw - ChatTopicCluster", "J5")
        == "yyyy-mm-dd hh:mm:ss"
    )


def test_write_excel_degrades_activity_sheet_when_upstream_activity_data_is_partial(
    tmp_path,
):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record(
        "AggregatedCourseAnalytics",
        [
            {
                "courseId": "course-1",
                "courseParticipantCount": 2,
                "activityMonday": 0.0,
                "activityTuesday": 0.0,
                "activityWednesday": 0.0,
                "activityThursday": 0.0,
                "activityFriday": 0.0,
                "activitySaturday": 0.0,
                "activitySunday": 0.0,
            }
        ],
    )
    buffer.record(
        "ParticipantCourseAnalytics",
        [
            {
                "participantId": "p1",
                "activeWeeks": 0,
                "activeDaysPerWeek": 0,
                "meanElementsPerDay": 0,
                "activityLevel": "LOW",
                "hasChatActivity": False,
            }
        ],
    )
    buffer.record(
        "ParticipantPerformance",
        [
            {
                "participantId": "p1",
                "totalErrorRate": 0.2,
                "firstErrorRate": 0.3,
                "lastErrorRate": 0.1,
                "totalPerformance": "HIGH",
            }
        ],
    )
    buffer.record_script(
        "src.scripts.0_initial_participant_analytics",
        1.23,
        rows_written=61,
        status="failed",
        error="ValueError: Unknown element type: SELECTION",
    )

    output = tmp_path / "activity-warning.xlsx"
    write_excel(buffer, output, {"course_id": "course-1"})

    activity_values = _sheet_values(output, "10 Activity")
    assert "Activity Data Warning" in activity_values.values()
    assert (
        "Participant analytics script failed in this run." in activity_values.values()
    )
    assert "Participant Activity Table" not in activity_values.values()
    assert "Participant Activity Histogram" not in activity_values.values()
    assert _sheet_state(_workbook_xml(output), "11 Performance") is None


def test_write_excel_marks_single_topic_cluster_as_low_signal(tmp_path):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record(
        "ChatTopicCluster",
        [
            {
                "type": "COURSE",
                "timestamp": date(2026, 4, 20),
                "chatbotId": "cb-1",
                "clusterIndex": 0,
                "clusterLabel": "topic",
                "messageCount": 222,
                "participantCount": 41,
            }
        ],
    )

    output = tmp_path / "topic-note.xlsx"
    write_excel(buffer, output, {"course_id": "course-1"})

    chat_values = _sheet_values(output, "12 Chat")
    assert "Retained Topic Cluster" in chat_values.values()
    assert (
        "Single retained cluster after privacy/noise collapse: 222 messages from 41 participants."
        in chat_values.values()
    )


def test_write_excel_course_scope_omits_platform_sheet(tmp_path):
    from src.dryrun.interceptor import write_excel

    buffer = CaptureBuffer()
    buffer.record("ParticipantAnalytics", [{"id": 1}])
    buffer.record(
        "PlatformSemesterAnalytics",
        [{"semesterLabel": "FS26", "quizDistinctParticipants": 10}],
    )

    output = tmp_path / "course-scope.xlsx"
    write_excel(
        buffer,
        output,
        {
            "course_id": "test",
            "scope_mode": "course",
            "omitted_domains": {
                "Platform": "Intentionally omitted for course-scoped dry run."
            },
        },
    )

    workbook = _workbook_xml(output)
    assert "14 Platform" not in _sheet_names(workbook)


def test_sheet_name_truncation_handles_long_table_names(tmp_path):
    from src.dryrun.interceptor import write_excel

    long_name = "AReallyLongTableNameThatExceedsExcelLimitByALot"  # > 31 chars
    buffer = CaptureBuffer()
    buffer.record(long_name, [{"id": 1}])

    output = tmp_path / "long.xlsx"
    write_excel(buffer, output, {"course_id": "test"})
    workbook = _workbook_xml(output)
    sheet_names = _sheet_names(workbook)
    assert any(name.startswith("90 Raw - ") for name in sheet_names)
    assert "99 Diagnostics" in sheet_names


_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def _workbook_xml(path):
    with zipfile.ZipFile(path) as zf:
        return ET.fromstring(zf.read("xl/workbook.xml"))


def _sheet_names(workbook):
    return [
        sheet.attrib["name"]
        for sheet in workbook.findall("./main:sheets/main:sheet", _NS)
    ]


def _sheet_state(workbook, sheet_name):
    for sheet in workbook.findall("./main:sheets/main:sheet", _NS):
        if sheet.attrib["name"] == sheet_name:
            return sheet.attrib.get("state")
    raise AssertionError(f"sheet {sheet_name} not found")


def _sheet_xml(path, sheet_name):
    with zipfile.ZipFile(path) as zf:
        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))

        rid = None
        for sheet in workbook.findall("./main:sheets/main:sheet", _NS):
            if sheet.attrib["name"] == sheet_name:
                rid = sheet.attrib[
                    "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
                ]
                break
        assert rid is not None, f"sheet {sheet_name} not found"

        target = None
        for rel in rels.findall("./pkg:Relationship", _NS):
            if rel.attrib["Id"] == rid:
                target = rel.attrib["Target"]
                break
        assert target is not None, f"relationship for {sheet_name} not found"
        return ET.fromstring(zf.read(f"xl/{target}"))


def _shared_strings(path):
    with zipfile.ZipFile(path) as zf:
        try:
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
        except KeyError:
            return []
    values = []
    for item in root.findall("./main:si", _NS):
        texts = item.findall(".//main:t", _NS)
        values.append("".join(t.text or "" for t in texts))
    return values


def _sheet_values(path, sheet_name):
    shared = _shared_strings(path)
    root = _sheet_xml(path, sheet_name)
    values = {}
    for cell in root.findall(".//main:c", _NS):
        ref = cell.attrib.get("r")
        if ref is None:
            continue
        cell_type = cell.attrib.get("t")
        if cell_type == "s":
            idx = int(cell.findtext("./main:v", default="0", namespaces=_NS))
            values[ref] = shared[idx]
        elif cell_type == "inlineStr":
            values[ref] = "".join(t.text or "" for t in cell.findall(".//main:t", _NS))
        else:
            values[ref] = cell.findtext("./main:v", default="", namespaces=_NS)
    return values


def _cell_number_format(path, sheet_name, cell_ref):
    builtins = {
        0: "General",
        14: "mm-dd-yy",
        22: "m/d/yy h:mm",
    }
    sheet = _sheet_xml(path, sheet_name)
    cell = sheet.find(f'.//main:c[@r="{cell_ref}"]', _NS)
    assert cell is not None, f"cell {cell_ref} not found on {sheet_name}"
    style_idx = int(cell.attrib.get("s", "0"))

    with zipfile.ZipFile(path) as zf:
        styles = ET.fromstring(zf.read("xl/styles.xml"))

    num_fmts = {
        int(node.attrib["numFmtId"]): node.attrib["formatCode"]
        for node in styles.findall("./main:numFmts/main:numFmt", _NS)
    }
    xfs = styles.findall("./main:cellXfs/main:xf", _NS)
    xf = xfs[style_idx]
    num_fmt_id = int(xf.attrib.get("numFmtId", "0"))
    return num_fmts.get(num_fmt_id, builtins.get(num_fmt_id, "General"))
