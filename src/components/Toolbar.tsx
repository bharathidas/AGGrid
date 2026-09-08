import { ChangeEvent, ReactElement, ReactNode } from "react";
import { ClearIcon, CsvIcon, ExcelIcon, RefreshIcon, ResetIcon } from "./Icons";

export interface ToolbarLabels {
    refresh: string;
    reset: string;
    exportExcel: string;
    exportCsv: string;
    /** Template for the selection counter; [count] is replaced. */
    selected: string;
    clear: string;
}

export interface ToolbarProps {
    labels: ToolbarLabels;
    showQuickFilter: boolean;
    quickFilterText: string;
    quickFilterPlaceholder: string;
    onQuickFilterChange: (text: string) => void;
    showExportCsv: boolean;
    onExportCsv: () => void;
    showExportExcel: boolean;
    onExportExcel: () => void;
    exporting: boolean;
    showReset: boolean;
    onReset: () => void;
    showRefresh: boolean;
    onRefresh: () => void;
    /** Number of selected rows to announce; 0 hides the counter. */
    selectionCount: number;
    onClearSelection: () => void;
    children?: ReactNode;
}

export function Toolbar(props: ToolbarProps): ReactElement | null {
    const { labels } = props;
    const hasButtons =
        props.showExportCsv || props.showExportExcel || props.showReset || props.showRefresh || Boolean(props.children);
    const hasCounter = props.selectionCount > 0;
    if (!props.showQuickFilter && !hasButtons && !hasCounter) {
        return null;
    }

    return (
        <div className="mxt-ag-toolbar">
            {props.showQuickFilter && (
                <input
                    type="search"
                    className="form-control mxt-ag-toolbar__search"
                    placeholder={props.quickFilterPlaceholder}
                    aria-label={props.quickFilterPlaceholder}
                    value={props.quickFilterText}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => props.onQuickFilterChange(event.target.value)}
                />
            )}
            {hasCounter && (
                <div className="mxt-ag-toolbar__selection" aria-live="polite">
                    <span>{labels.selected.replace("[count]", String(props.selectionCount))}</span>
                    <button
                        type="button"
                        className="btn btn-link mxt-ag-btn mxt-ag-toolbar__clear"
                        onClick={props.onClearSelection}
                    >
                        <ClearIcon />
                        <span>{labels.clear}</span>
                    </button>
                </div>
            )}
            {hasButtons && (
                <div className="mxt-ag-toolbar__buttons">
                    {props.children}
                    {props.showRefresh && (
                        <button type="button" className="btn btn-default mxt-ag-btn" onClick={props.onRefresh}>
                            <RefreshIcon />
                            <span>{labels.refresh}</span>
                        </button>
                    )}
                    {props.showReset && (
                        <button type="button" className="btn btn-default mxt-ag-btn" onClick={props.onReset}>
                            <ResetIcon />
                            <span>{labels.reset}</span>
                        </button>
                    )}
                    {props.showExportExcel && (
                        <button
                            type="button"
                            className="btn btn-default mxt-ag-btn"
                            disabled={props.exporting}
                            onClick={props.onExportExcel}
                        >
                            <ExcelIcon />
                            <span>{props.exporting ? `${labels.exportExcel}…` : labels.exportExcel}</span>
                        </button>
                    )}
                    {props.showExportCsv && (
                        <button
                            type="button"
                            className="btn btn-default mxt-ag-btn"
                            disabled={props.exporting}
                            onClick={props.onExportCsv}
                        >
                            <CsvIcon />
                            <span>{labels.exportCsv}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
