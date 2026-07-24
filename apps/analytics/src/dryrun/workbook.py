"""Excel writer for analytics dry-run captures."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Sequence

from src.dryrun.interceptor import CaptureBuffer
from src.dryrun.workbook_sections import (
    _DOMAIN_TABLES,
    _activity_sections,
    _chat_sections,
    _column_width,
    _diagnostics_rows,
    _domain_table_status,
    _format_name_for_column,
    _has_visible_summary_content,
    _live_quiz_sections,
    _load_analytics_reference,
    _omitted_domain_notes,
    _performance_sections,
    _platform_sections,
    _safe_sheet,
    _table_df,
    _table_row_positions,
    _visible_metadata_rows,
    _visible_table_notes,
    _write_data_cell,
)


def _write_table(
    workbook,
    worksheet,
    df,
    *,
    start_row: int,
    title: str | None = None,
    subtitle: str | None = None,
    formats: Mapping[str, Any],
    table_name: str,
    autofit: bool = True,
):
    import pandas as pd

    row = start_row
    if title:
        worksheet.write(row, 0, title, formats["section_title"])
        row += 1
    if subtitle:
        worksheet.write(row, 0, subtitle, formats["section_subtitle"])
        row += 1

    if df is None:
        worksheet.write(row, 0, "Unavailable for this run.", formats["note"])
        return row + 2

    if not isinstance(df, pd.DataFrame):
        df = pd.DataFrame(df)

    if df.empty and len(df.columns) == 0:
        worksheet.write(row, 0, "Unavailable for this run.", formats["note"])
        return row + 2

    data_row = row
    for col_idx, column in enumerate(df.columns):
        worksheet.write(data_row, col_idx, column, formats["header"])

    if not df.empty:
        for rel_row, (_, series_row) in enumerate(df.iterrows(), start=1):
            for col_idx, column in enumerate(df.columns):
                _write_data_cell(
                    worksheet,
                    data_row + rel_row,
                    col_idx,
                    series_row[column],
                    column,
                    formats,
                )
    else:
        worksheet.write(
            data_row + 1,
            0,
            "No rows captured for this table in the selected dry run.",
            formats["note"],
        )

    last_row = data_row + max(len(df), 1)
    last_col = max(len(df.columns) - 1, 0)
    worksheet.add_table(
        data_row,
        0,
        last_row,
        last_col,
        {
            "name": table_name[:255],
            "style": "Table Style Medium 2",
            "columns": [{"header": column} for column in df.columns],
            "autofilter": True,
            "banded_rows": True,
        },
    )

    if autofit:
        for col_idx, column in enumerate(df.columns):
            worksheet.set_column(
                col_idx,
                col_idx,
                _column_width(df[column] if column in df else [], column),
                formats[_format_name_for_column(column)],
            )

    return last_row + 3


def _add_chart(
    workbook,
    worksheet,
    *,
    chart_type: str,
    x_col: int,
    y_col: int,
    first_row: int,
    last_row: int,
    title: str,
    position: str,
):
    if last_row <= first_row:
        return
    chart = workbook.add_chart({"type": chart_type})
    chart.add_series(
        {
            "categories": [worksheet.name, first_row, x_col, last_row, x_col],
            "values": [worksheet.name, first_row, y_col, last_row, y_col],
            "name": title,
        }
    )
    chart.set_title({"name": title})
    chart.set_legend({"none": True})
    chart.set_size({"width": 520, "height": 280})
    worksheet.insert_chart(position, chart)


def _summary_sheet(
    workbook,
    worksheet,
    *,
    title: str,
    intro: str,
    sections: Sequence[tuple[str, str, Any, dict[str, Any]]],
    formats: Mapping[str, Any],
):
    import pandas as pd

    worksheet.write(0, 0, title, formats["title"])
    worksheet.write(1, 0, intro, formats["subtitle"])
    worksheet.freeze_panes(2, 0)
    row = 3
    chart_slots = ["J3", "J22", "J41", "J60"]
    chart_idx = 0

    for section_title, section_subtitle, data, options in sections:
        before = row

        render_data = data
        sort_by = options.get("sort_by") if options.get("chart") else None
        if sort_by and data is not None:
            df_sort = data if isinstance(data, pd.DataFrame) else pd.DataFrame(data)
            if sort_by in df_sort.columns:
                render_data = df_sort.sort_values(sort_by, ascending=False).reset_index(drop=True)

        row = _write_table(
            workbook,
            worksheet,
            render_data,
            start_row=row,
            title=section_title,
            subtitle=section_subtitle,
            formats=formats,
            table_name=f"tbl_{worksheet.name}_{before}".replace(" ", "_"),
        )
        if options.get("chart") and render_data is not None:
            df = render_data if isinstance(render_data, pd.DataFrame) else pd.DataFrame(render_data)
            if not df.empty:
                chart_slots_idx = min(chart_idx, len(chart_slots) - 1)
                top_n = options.get("top_n")
                chart_rows = min(top_n, len(df)) if top_n else len(df)
                _add_chart(
                    workbook,
                    worksheet,
                    chart_type=options["chart"],
                    x_col=df.columns.get_loc(options["x"]),
                    y_col=df.columns.get_loc(options["y"]),
                    first_row=before + 3,
                    last_row=before + 2 + chart_rows,
                    title=section_title,
                    position=chart_slots[chart_slots_idx],
                )
                chart_idx += 1


def write_excel(
    buffer: CaptureBuffer,
    output_path: Path,
    metadata: Mapping[str, Any],
) -> None:
    """Write ``buffer`` to a structured dry-run workbook."""

    import pandas as pd

    refs = _load_analytics_reference()
    used_names: set[str] = set()
    omitted_domains = _omitted_domain_notes(metadata)
    omitted_tables = {table for domain in omitted_domains for table in _DOMAIN_TABLES.get(domain, ())}
    include_platform = "Platform" not in omitted_domains

    with pd.ExcelWriter(output_path, engine="xlsxwriter") as writer:
        workbook = writer.book
        formats = {
            "title": workbook.add_format({"bold": True, "font_name": "Arial", "font_size": 16}),
            "subtitle": workbook.add_format({"font_name": "Arial", "font_size": 10, "font_color": "#555555"}),
            "section_title": workbook.add_format({"bold": True, "font_name": "Arial", "font_size": 12}),
            "section_subtitle": workbook.add_format({"font_name": "Arial", "font_size": 9, "font_color": "#666666"}),
            "header": workbook.add_format(
                {
                    "bold": True,
                    "font_name": "Arial",
                    "bg_color": "#D9E2F3",
                    "border": 1,
                }
            ),
            "note": workbook.add_format({"font_name": "Arial", "italic": True, "font_color": "#666666"}),
            "default": workbook.add_format({"font_name": "Arial"}),
            "date": workbook.add_format({"font_name": "Arial", "num_format": "yyyy-mm-dd"}),
            "datetime": workbook.add_format({"font_name": "Arial", "num_format": "yyyy-mm-dd hh:mm:ss"}),
            "int": workbook.add_format({"font_name": "Arial", "num_format": "#,##0"}),
            "percent": workbook.add_format({"font_name": "Arial", "num_format": "0.0%"}),
        }

        # 00 Run Health
        run_health = workbook.add_worksheet(_safe_sheet("00 Run Health", used_names))
        writer.sheets[run_health.name] = run_health
        run_health.write(0, 0, "Analytics Dry-Run Workbook", formats["title"])
        run_health.write(
            1,
            0,
            "This workbook balances human-readable summaries with raw captured tables from the dry run.",
            formats["subtitle"],
        )
        run_health.freeze_panes(2, 0)

        meta_rows = _visible_metadata_rows(metadata)
        row = _write_table(
            workbook,
            run_health,
            pd.DataFrame(meta_rows),
            start_row=3,
            title="Run Metadata",
            subtitle="Scope, execution context, and generation metadata.",
            formats=formats,
            table_name="tbl_run_metadata",
        )

        domain_rows = []
        for domain, tables in _DOMAIN_TABLES.items():
            if domain in omitted_domains:
                status = "skipped"
                note = omitted_domains[domain]
                tables_label = "intentionally omitted"
            else:
                status, note = _domain_table_status(buffer, tables)
                tables_label = ", ".join(table for table in tables if table in buffer.table_status) or "none"
            domain_rows.append(
                {
                    "domain": domain,
                    "status": status,
                    "tables": tables_label,
                    "note": note,
                }
            )
        row = _write_table(
            workbook,
            run_health,
            pd.DataFrame(domain_rows),
            start_row=row,
            title="Domain Status",
            subtitle="Produced, empty, skipped, or failed domains for this workbook.",
            formats=formats,
            table_name="tbl_domain_status",
        )

        scripts_df = pd.DataFrame(buffer.scripts)
        if scripts_df.empty:
            scripts_df = pd.DataFrame(
                [
                    {
                        "script": "none",
                        "status": "skipped",
                        "elapsed_s": 0.0,
                        "rows_written": 0,
                        "error": "no scripts recorded",
                    }
                ]
            )
        _write_table(
            workbook,
            run_health,
            scripts_df[
                [
                    column
                    for column in ("script", "status", "elapsed_s", "rows_written", "error")
                    if column in scripts_df.columns
                ]
            ],
            start_row=row,
            title="Script Matrix",
            subtitle="One row per analytics script in the run.",
            formats=formats,
            table_name="tbl_scripts",
        )

        index_sheet = workbook.add_worksheet(_safe_sheet("01 Index", used_names))
        writer.sheets[index_sheet.name] = index_sheet

        # Summary sheets
        summary_specs = [
            (
                "10 Activity",
                "Activity Summary",
                "Course activity views modelled after the lecturer analytics dashboard.",
                _activity_sections(buffer, metadata),
            ),
            (
                "11 Performance",
                "Performance Summary",
                "Course performance views modelled after the lecturer analytics dashboard.",
                _performance_sections(buffer, metadata),
            ),
            (
                "12 Chat",
                "Chat Summary",
                "Readable chatbot and topic-cluster summaries, with raw tables preserved separately.",
                _chat_sections(buffer, metadata),
            ),
            (
                "13 Live Quiz",
                "Live Quiz Summary",
                "Assessment-mode live quiz summaries for the captured course scope.",
                _live_quiz_sections(buffer, metadata),
            ),
        ]
        if include_platform:
            summary_specs.append(
                (
                    "14 Platform",
                    "Platform Summary",
                    "Compact semester rollup for platform-level analytics written by the dry run.",
                    _platform_sections(buffer, metadata),
                )
            )

        visible_summary_rows = [
            {
                "sheet": "00 Run Health",
                "kind": "Summary",
                "description": "Run scope, warnings, and per-script status.",
            }
        ]

        for sheet_name, title, intro, sections in summary_specs:
            worksheet = workbook.add_worksheet(_safe_sheet(sheet_name, used_names))
            writer.sheets[worksheet.name] = worksheet
            _summary_sheet(
                workbook,
                worksheet,
                title=title,
                intro=intro,
                sections=sections,
                formats=formats,
            )
            if not _has_visible_summary_content(sections):
                worksheet.hide()
                continue
            visible_summary_rows.append(
                {
                    "sheet": worksheet.name,
                    "kind": "Summary",
                    "description": intro,
                }
            )

        # Raw sheets
        raw_sheet_names: list[tuple[str, str]] = []
        for table in buffer.table_status:
            if table in omitted_tables:
                continue
            status = buffer.table_status.get(table)
            if status not in {"produced", "empty"}:
                continue
            sheet_name = _safe_sheet(f"90 Raw - {table}", used_names)
            worksheet = workbook.add_worksheet(sheet_name)
            writer.sheets[sheet_name] = worksheet
            worksheet.write(0, 0, f"Raw Table: {table}", formats["title"])
            reference = refs.get(table, {})
            subtitle_parts = []
            if reference.get("grain"):
                subtitle_parts.append(f"Grain: {reference['grain']}")
            if reference.get("source"):
                subtitle_parts.append(f"Source: {reference['source']}")
            if not subtitle_parts:
                subtitle_parts.append("Direct capture of rows the pipeline would have written.")
            worksheet.write(1, 0, " | ".join(subtitle_parts), formats["subtitle"])
            notes = " | ".join(_visible_table_notes(buffer.table_notes.get(table, [])))
            if notes:
                worksheet.write(2, 0, notes, formats["section_subtitle"])

            df = _table_df(buffer, table)
            data_start = 3
            for col_idx, column in enumerate(df.columns):
                worksheet.write(data_start, col_idx, column, formats["header"])
            if not df.empty:
                for rel_row, (_, series_row) in enumerate(df.iterrows(), start=1):
                    for col_idx, column in enumerate(df.columns):
                        _write_data_cell(
                            worksheet,
                            data_start + rel_row,
                            col_idx,
                            series_row[column],
                            column,
                            formats,
                        )
            else:
                worksheet.write(
                    data_start + 1,
                    0,
                    "No rows captured for this table in the selected dry run.",
                    formats["note"],
                )

            last_row = data_start + max(len(df), 1)
            last_col = max(len(df.columns) - 1, 0)
            worksheet.add_table(
                data_start,
                0,
                last_row,
                last_col,
                {
                    "name": f"raw_{table}"[:255],
                    "style": "Table Style Medium 2",
                    "columns": [{"header": column} for column in df.columns],
                    "autofilter": True,
                },
            )
            worksheet.autofilter(data_start, 0, last_row, last_col)
            worksheet.freeze_panes(data_start + 1, 0)
            for col_idx, column in enumerate(df.columns):
                worksheet.set_column(
                    col_idx,
                    col_idx,
                    _column_width(df[column] if column in df else [], column),
                    formats[_format_name_for_column(column)],
                )
            if status == "empty":
                worksheet.hide()
                continue
            raw_sheet_names.append((sheet_name, table))

        # 99 Diagnostics
        diagnostics = workbook.add_worksheet(_safe_sheet("99 Diagnostics", used_names))
        writer.sheets[diagnostics.name] = diagnostics
        diagnostics.write(0, 0, "Diagnostics", formats["title"])
        diagnostics.write(
            1,
            0,
            "Concise diagnostics for skipped or failed write captures. Full SQL is stored on a hidden debug sheet.",
            formats["subtitle"],
        )
        diagnostics.freeze_panes(2, 0)

        _write_table(
            workbook,
            diagnostics,
            pd.DataFrame(_diagnostics_rows(buffer.skipped_writes)),
            start_row=3,
            title="Skipped / Failed Writes",
            subtitle="High-signal diagnostics only.",
            formats=formats,
            table_name="tbl_diagnostics",
        )

        # Hidden debug SQL sheet
        debug_sheet = workbook.add_worksheet(_safe_sheet("99 Debug SQL", used_names))
        writer.sheets[debug_sheet.name] = debug_sheet
        debug_sheet.hide()
        debug_df = pd.DataFrame(
            buffer.skipped_writes or [{"verb": "none", "sql": "", "params": "", "table": "", "note": ""}]
        )
        _write_table(
            workbook,
            debug_sheet,
            debug_df,
            start_row=0,
            title="Full Debug SQL",
            subtitle="Hidden sheet with full skipped-write payloads.",
            formats=formats,
            table_name="tbl_debug_sql",
        )

        # Populate the index after all sheet names are known.
        index_sheet.write(0, 0, "Workbook Index", formats["title"])
        index_sheet.write(
            1,
            0,
            "Guide to summary, raw, and diagnostic sheets in this dry-run workbook.",
            formats["subtitle"],
        )
        index_rows = list(visible_summary_rows)
        for sheet_name, table in raw_sheet_names:
            index_rows.append(
                {
                    "sheet": sheet_name,
                    "kind": "Raw",
                    "description": f"Raw capture for {table} ({buffer.table_status.get(table)})",
                }
            )
        index_rows.append(
            {
                "sheet": "99 Diagnostics",
                "kind": "Diagnostics",
                "description": "Concise skipped-write diagnostics.",
            }
        )
        header_row, first_data_row = _table_row_positions(
            start_row=3,
            title="Sheet Guide",
            subtitle="Use this as the navigation entry point into the workbook.",
        )
        row = _write_table(
            workbook,
            index_sheet,
            pd.DataFrame(index_rows),
            start_row=3,
            title="Sheet Guide",
            subtitle="Use this as the navigation entry point into the workbook.",
            formats=formats,
            table_name="tbl_index",
        )
        for offset, entry in enumerate(index_rows, start=first_data_row):
            target = entry["sheet"].replace("'", "''")
            index_sheet.write_url(
                offset,
                0,
                f"internal:'{target}'!A1",
                formats["default"],
                string=entry["sheet"],
            )
        index_sheet.write(row, 0, "Legend", formats["section_title"])
        index_sheet.write(row + 1, 0, "produced", formats["default"])
        index_sheet.write(row + 1, 1, "Captured rows exist for this table or domain.", formats["default"])
        index_sheet.write(row + 2, 0, "empty", formats["default"])
        index_sheet.write(row + 2, 1, "Script ran but produced zero rows for the selected scope.", formats["default"])
        index_sheet.write(row + 3, 0, "skipped", formats["default"])
        index_sheet.write(
            row + 3, 1, "Target DB schema drift or preflight rules prevented capture.", formats["default"]
        )
        index_sheet.write(row + 4, 0, "failed", formats["default"])
        index_sheet.write(
            row + 4, 1, "The interceptor could not safely capture the would-be write.", formats["default"]
        )
