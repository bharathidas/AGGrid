import { CSSProperties, ReactElement, ReactNode } from "react";
import { Selectable } from "mendix/preview/Selectable";

import { ColumnsPreviewType, AGGridPreviewProps } from "../typings/AGGridProps";
import { pagingStatus, totalsCaption } from "./AGGrid.editorConfig";
import { headerGroups } from "./utils/headerGroups";
import { ColumnsIcon, CsvIcon, ExcelIcon, RefreshIcon, ResetIcon } from "./components/Icons";

/**
 * Design-time preview that reuses the Data Grid 2 markup and class names (widget-datagrid, th, td,
 * pagination-bar, ...), so the Atlas theme styles it exactly like a Data Grid 2 in Studio Pro.
 */

const SAMPLE_ROWS = 3;

const PREVIEW_CSS = `
svg.svg-inline--fa { height: 15px; }
.widget-datagrid.mxt-ag-preview .table .th { z-index: unset; }
.widget-datagrid.mxt-ag-preview .th.hidden-column-preview { background-color: #e7e7e9; }
.widget-datagrid.mxt-ag-preview .td.hidden-column-preview { background-color: #f8f8f8; }
.widget-datagrid.mxt-ag-preview .tr.tr-preview:nth-last-child(2) > .td { opacity: 0.5; }
.widget-datagrid.mxt-ag-preview .tr.tr-preview:last-child > .td { opacity: 0.2; }
.widget-datagrid.mxt-ag-preview .tr.tr-totals > .td { font-weight: 600; }
.widget-datagrid.mxt-ag-preview .mxt-ag-preview-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 0; }
.widget-datagrid.mxt-ag-preview .mxt-ag-preview-toolbar .form-control { max-width: 260px; }
.widget-datagrid.mxt-ag-preview .mxt-ag-preview-toolbar .btn { margin: 0; }
.widget-datagrid.mxt-ag-preview .btn.mxt-ag-btn { display: inline-flex; align-items: center; justify-content: center; }
.widget-datagrid.mxt-ag-preview .mxt-ag-btn .mxt-ag-icon { width: 14px; height: 14px; flex-shrink: 0; margin-right: 6px; vertical-align: -2px; }
.widget-datagrid.mxt-ag-preview .mxt-ag-preview-buttons { display: flex; gap: 8px; margin-left: auto; }
.widget-datagrid.mxt-ag-preview .filter .form-control { height: 28px; padding: 2px 6px; font-size: 12px; }
.widget-datagrid.mxt-ag-preview .td-number { text-align: right; justify-content: flex-end; }
.widget-datagrid.mxt-ag-preview .td-center { text-align: center; justify-content: center; }
.widget-datagrid.mxt-ag-preview .th.mxt-ag-preview-group { justify-content: center; border-bottom: 1px solid #ced0d3; }
.widget-datagrid.mxt-ag-preview .th.mxt-ag-preview-group .column-header { justify-content: center; }
`;

function SortIcon(): ReactElement {
    return (
        <svg
            aria-hidden="true"
            focusable="false"
            className="svg-inline--fa fa-arrows-alt-v fa-w-8"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 512"
        >
            <path
                fill="currentColor"
                d="M214.059 377.941H168V134.059h46.059c21.382 0 32.09-25.851 16.971-40.971L144.971 7.029c-9.373-9.373-24.568-9.373-33.941 0L24.971 93.088c-15.119 15.119-4.411 40.971 16.971 40.971H88v243.882H41.941c-21.382 0-32.09 25.851-16.971 40.971l86.059 86.059c9.373 9.373 24.568 9.373 33.941 0l86.059-86.059c15.12-15.119 4.412-40.971-16.97-40.971z"
            />
        </svg>
    );
}

function PagingIcon({
    direction
}: {
    direction: "step-backward" | "backward" | "forward" | "step-forward";
}): ReactElement {
    const paths: Record<string, string[]> = {
        forward: [
            "M17.81 6.63C17.48 6.37 17 6.61 17 7.02V24.98C17 25.4 17.48 25.63 17.81 25.37L28.5 16.39C28.76 16.19 28.76 15.8 28.5 15.6L17.81 6.63Z",
            "M4.81 6.63C4.48 6.37 4 6.61 4 7.02V24.98C4 25.4 4.48 25.63 4.81 25.37L15.5 16.39C15.76 16.19 15.76 15.8 15.5 15.6L4.81 6.63Z"
        ],
        "step-forward": [
            "M8.81 6.63C8.48 6.37 8 6.61 8 7.02V24.98C8 25.4 8.48 25.63 8.81 25.37L20.5 16.39C20.76 16.19 20.76 15.8 20.5 15.6L8.81 6.63Z",
            "M24 6H22V26H24V6Z"
        ],
        backward: [
            "M14.19 6.63L3.51 15.61C3.25 15.81 3.25 16.2 3.51 16.4L14.2 25.38C14.53 25.64 15.01 25.4 15.01 24.99V7.02C15.01 6.6 14.53 6.37 14.2 6.63H14.19Z",
            "M27.19 6.63L16.5 15.61C16.24 15.81 16.24 16.2 16.5 16.4L27.19 25.38C27.52 25.64 28 25.4 28 24.99V7.02C28 6.6 27.52 6.37 27.19 6.63Z"
        ],
        "step-backward": [
            "M23.19 6.63L11.51 15.61C11.25 15.81 11.25 16.2 11.51 16.4L23.2 25.38C23.53 25.64 24.01 25.4 24.01 24.99V7.02C24.01 6.6 23.53 6.37 23.2 6.63H23.19Z",
            "M10 6H8V26H10V6Z"
        ]
    };
    return (
        <span aria-hidden>
            <svg
                className={`pagination-icon ${direction}`}
                viewBox="0 0 32 32"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
            >
                {paths[direction].map(d => (
                    <path key={d} d={d} fill="currentColor" />
                ))}
            </svg>
        </span>
    );
}

function captionOf(column: ColumnsPreviewType, index: number): string {
    if (column.header?.trim()) {
        return column.header;
    }
    if (column.columnType === "attribute" && column.attribute) {
        return column.attribute.split("/").pop() ?? column.attribute;
    }
    return column.columnType === "dynamicText" ? "Dynamic text" : `Column ${index + 1}`;
}

function cellContent(column: ColumnsPreviewType): ReactNode {
    switch (column.columnType) {
        case "attribute":
            return <span className="td-text">[{column.attribute || "No attribute selected"}]</span>;
        case "dynamicText":
            return <span className="td-text">{column.dynamicText || "Dynamic text"}</span>;
        default: {
            const Content = column.content.renderer;
            return (
                <Content>
                    <div style={{ flexGrow: 1 }} />
                </Content>
            );
        }
    }
}

function cssWidth(column: ColumnsPreviewType): string {
    switch (column.widthMode) {
        case "fixed":
            return `${column.width ?? 150}px`;
        case "auto":
            return "minmax(auto, auto)";
        default:
            return `${column.flex ?? 1}fr`;
    }
}

function alignmentClass(column: ColumnsPreviewType): string {
    if (column.alignment === "right") {
        return " td-number";
    }
    if (column.alignment === "center") {
        return " td-center";
    }
    return "";
}

export function preview(props: AGGridPreviewProps): ReactElement {
    const columns = props.columns;
    const hasSelection = props.selection !== "None" && props.checkboxSelection;
    const hasToolbar =
        props.showQuickFilter ||
        props.showExportButton ||
        props.showResetButton ||
        props.showRefreshButton ||
        props.showColumnChooser;
    const widths: string[] = [];
    if (hasSelection) {
        widths.push("48px");
    }
    if (props.showRowNumbers) {
        widths.push("56px");
    }
    widths.push(...(columns.length > 0 ? columns.map(cssWidth) : ["1fr"]));
    const gridStyle = { "--widgets-grid-template-columns": widths.join(" ") } as CSSProperties;
    const spanAll = columns.length + (hasSelection ? 1 : 0) + (props.showRowNumbers ? 1 : 0);
    const EmptyPlaceholder = props.emptyPlaceholder.renderer;
    const groups = headerGroups(columns);

    const headerCell = (column: ColumnsPreviewType, index: number): ReactElement => {
        const hidden = column.visible.trim() === "false";
        const sortable = column.sortable && column.columnType !== "customContent";
        const filterable =
            props.floatingFilters && column.filterType !== "none" && column.columnType !== "customContent";
        return (
            <Selectable key={index} object={column} caption={captionOf(column, index)}>
                <div className={`th${hidden ? " hidden-column-preview" : ""}`} role="columnheader">
                    <div className="column-container">
                        <div className="column-header">
                            <span>{captionOf(column, index)}</span>
                            {sortable && <SortIcon />}
                        </div>
                        <div className="filter" style={filterable ? undefined : { display: "none" }}>
                            <input className="form-control" readOnly value="" placeholder="" />
                        </div>
                    </div>
                </div>
            </Selectable>
        );
    };

    return (
        <div className={`widget-datagrid mxt-ag-preview ${props.className ?? ""}`} style={props.styleObject}>
            {hasToolbar && (
                <div className="widget-datagrid-header header-filters mxt-ag-preview-toolbar">
                    {props.showQuickFilter && (
                        <input
                            className="form-control"
                            readOnly
                            value=""
                            placeholder={props.quickFilterPlaceholder || "Search..."}
                        />
                    )}
                    <div className="mxt-ag-preview-buttons">
                        {props.showColumnChooser && (
                            <button className="btn btn-default mxt-ag-btn">
                                <ColumnsIcon />
                                <span>{props.labelColumns || "Columns"}</span>
                            </button>
                        )}
                        {props.showRefreshButton && (
                            <button className="btn btn-default mxt-ag-btn">
                                <RefreshIcon />
                                <span>{props.labelRefresh || "Refresh"}</span>
                            </button>
                        )}
                        {props.showResetButton && (
                            <button className="btn btn-default mxt-ag-btn">
                                <ResetIcon />
                                <span>{props.labelReset || "Reset"}</span>
                            </button>
                        )}
                        {props.showExportButton && props.exportFormat !== "csv" && (
                            <button className="btn btn-default mxt-ag-btn">
                                <ExcelIcon />
                                <span>{props.labelExportExcel || "Export Excel"}</span>
                            </button>
                        )}
                        {props.showExportButton && props.exportFormat !== "excel" && (
                            <button className="btn btn-default mxt-ag-btn">
                                <CsvIcon />
                                <span>{props.labelExportCsv || "Export CSV"}</span>
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className="widget-datagrid-content">
                <div className="widget-datagrid-grid table" style={gridStyle}>
                    <div className="widget-datagrid-grid-head">
                        {groups.some(group => group.caption) && (
                            <div className="tr">
                                {hasSelection && <div className="th widget-datagrid-col-select" role="columnheader" />}
                                {props.showRowNumbers && <div className="th" role="columnheader" />}
                                {groups.map((group, index) => (
                                    <div
                                        key={index}
                                        className="th mxt-ag-preview-group"
                                        role="columnheader"
                                        style={{ gridColumn: `span ${group.span}` }}
                                    >
                                        <div className="column-container">
                                            <div className="column-header">
                                                <span>{group.caption}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="tr">
                            {hasSelection && (
                                <div className="th widget-datagrid-col-select" role="columnheader">
                                    {props.selection === "Multi" && props.headerCheckbox ? (
                                        <input type="checkbox" readOnly />
                                    ) : null}
                                </div>
                            )}
                            {props.showRowNumbers && (
                                <div className="th" role="columnheader">
                                    <div className="column-container">
                                        <div className="column-header">
                                            <span>#</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {columns.length > 0 ? (
                                columns.map(headerCell)
                            ) : (
                                <div className="th" role="columnheader">
                                    <div className="column-container">
                                        <div className="column-header">
                                            <span>Add columns to the grid</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="widget-datagrid-grid-body table-content">
                        {Array.from({ length: SAMPLE_ROWS }).map((_, row) => (
                            <div key={row} className="tr tr-preview">
                                {hasSelection && (
                                    <div
                                        className={`td widget-datagrid-col-select${row === 0 ? " td-borders" : ""}`}
                                        role="gridcell"
                                    >
                                        <input type="checkbox" readOnly />
                                    </div>
                                )}
                                {props.showRowNumbers && (
                                    <div className={`td${row === 0 ? " td-borders" : ""}`}>
                                        <span className="td-text">{row + 1}</span>
                                    </div>
                                )}
                                {columns.length > 0 ? (
                                    columns.map((column, index) => (
                                        <Selectable key={index} object={column} caption={captionOf(column, index)}>
                                            <div
                                                className={`td${row === 0 ? " td-borders" : ""}${
                                                    column.visible.trim() === "false" ? " hidden-column-preview" : ""
                                                }${alignmentClass(column)}`}
                                            >
                                                {cellContent(column)}
                                            </div>
                                        </Selectable>
                                    ))
                                ) : (
                                    <div className={`td${row === 0 ? " td-borders" : ""}`}>
                                        <span className="td-text">…</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {props.totalsRow !== "none" && (
                            <div className="tr tr-totals">
                                {hasSelection && <div className="td widget-datagrid-col-select" />}
                                {props.showRowNumbers && <div className="td" />}
                                {columns.map((column, index) => (
                                    <div key={index} className={`td${alignmentClass(column)}`}>
                                        <span className="td-text">{totalsCaption(props, column, index)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <EmptyPlaceholder caption="Empty placeholder: place widgets here">
                            <div className="td" style={{ gridColumn: `span ${Math.max(1, spanAll)}` }} />
                        </EmptyPlaceholder>
                    </div>
                </div>
            </div>
            {props.pagination && (
                <div className="widget-datagrid-footer table-footer">
                    <div className="widget-datagrid-paging-bottom">
                        <div className="widget-datagrid-pb-start" />
                        <div className="widget-datagrid-pb-middle" />
                        <div className="widget-datagrid-pb-end">
                            <div aria-label="Pagination" className="pagination-bar">
                                <button className="btn pagination-button" disabled aria-label="Go to first page">
                                    <PagingIcon direction="step-backward" />
                                </button>
                                <button className="btn pagination-button" disabled aria-label="Go to previous page">
                                    <PagingIcon direction="backward" />
                                </button>
                                <div aria-hidden className="paging-status">
                                    {pagingStatus(props)}
                                </div>
                                <button className="btn pagination-button" aria-label="Go to next page">
                                    <PagingIcon direction="forward" />
                                </button>
                                <button className="btn pagination-button" aria-label="Go to last page">
                                    <PagingIcon direction="step-forward" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function getPreviewCss(): string {
    return PREVIEW_CSS;
}
