"""Unit tests for analytics dry-run workbook rendering."""

from __future__ import annotations

import os
import sys
from datetime import date
import xml.etree.ElementTree as ET
import zipfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.dryrun.interceptor import CaptureBuffer  # noqa: E402
from src.dryrun.workbook import value_preview as _value_preview  # noqa: E402
from src.dryrun.workbook import write_excel  # noqa: E402


def test_value_preview_handles_plain_dates():
    assert _value_preview(date(2026, 4, 20)) == "2026-04-20"


def test_write_excel_produces_xlsx_with_expected_sheets(tmp_path):
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
    assert "No rows captured for this table in the selected dry run." in empty_sheet_values.values()
    assert "liveQuizId" in empty_sheet_values.values()
    assert "participantCount" in empty_sheet_values.values()
    assert _sheet_state(workbook, "13 Live Quiz") == "hidden"
    assert _sheet_state(workbook, "90 Raw - AggregatedLiveQuizAnal") == "hidden"

    index_values = _sheet_values(output, "01 Index")
    assert "13 Live Quiz" not in index_values.values()
    assert "90 Raw - AggregatedLiveQuizAnal" not in index_values.values()

    diagnostics_values = _sheet_values(output, "99 Diagnostics")
    assert "UPDATE-TEXT" in diagnostics_values.values()


def test_write_excel_index_links_do_not_overwrite_table_header(tmp_path):
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
    assert _cell_number_format(output, "90 Raw - ChatTopicCluster", "B5") == "yyyy-mm-dd"
    assert _cell_number_format(output, "90 Raw - ChatTopicCluster", "J5") == "yyyy-mm-dd hh:mm:ss"


def test_write_excel_degrades_activity_sheet_when_upstream_activity_data_is_partial(
    tmp_path,
):
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
    assert "Participant analytics script failed in this run." in activity_values.values()
    assert "Participant Activity Table" not in activity_values.values()
    assert "Participant Activity Histogram" not in activity_values.values()
    assert _sheet_state(_workbook_xml(output), "11 Performance") is None


def test_write_excel_marks_single_topic_cluster_as_low_signal(tmp_path):
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
            "omitted_domains": {"Platform": "Intentionally omitted for course-scoped dry run."},
        },
    )

    workbook = _workbook_xml(output)
    assert "14 Platform" not in _sheet_names(workbook)


def test_sheet_name_truncation_handles_long_table_names(tmp_path):
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
    return [sheet.attrib["name"] for sheet in workbook.findall("./main:sheets/main:sheet", _NS)]


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
                rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
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
