import { ReactElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GridApi, IDoesFilterPassParams } from "ag-grid-community";
import { CustomFilterProps, CustomFloatingFilterProps, useGridFilter } from "ag-grid-react";

import type { GridRow } from "../utils/rows";
import {
    BLANK_VALUE,
    DistinctValues,
    MAX_LISTED_VALUES,
    SetFilterModel,
    distinctValues,
    isSetFilterModel,
    matchingValues,
    selectedValues,
    setFilterPasses,
    setFilterSummary,
    toggleAllMatching,
    toggleSetValue
} from "../utils/setFilter";
import type { UiTexts } from "../utils/texts";
import { ChevronIcon } from "./Icons";

export interface SetFilterParams {
    colId: string;
    /** Every caption of an enumeration or boolean column (listed even when unused). */
    fixed?: string[];
    /** Only the fixed values are known (server data loading). */
    fixedOnly?: boolean;
    texts: () => UiTexts;
}

/** The distinct values of a column over the loaded data rows. */
export function columnValues(api: GridApi<GridRow> | undefined, params: SetFilterParams): DistinctValues {
    if (params.fixedOnly || !api) {
        return { values: params.fixed ?? [], hasBlanks: Boolean(params.fixedOnly && params.fixed) };
    }
    const rows: GridRow[] = [];
    api.forEachNode(node => {
        if (node.data && node.data.item && !node.data.totals && !node.data.detail && !node.data.group) {
            rows.push(node.data);
        }
    });
    return distinctValues(rows, params.colId, params.fixed);
}

export interface SetFilterPanelProps {
    list: DistinctValues;
    model: SetFilterModel | null;
    onChange: (model: SetFilterModel | null) => void;
    texts: UiTexts;
    columnName: string;
    /** Focus the search box when shown. */
    autoFocus?: boolean;
}

/** Checklist of the distinct values with a search box, (Select all) and (Blanks). */
export function SetFilterPanel(props: SetFilterPanelProps): ReactElement {
    const { list, model, onChange, texts } = props;
    const [search, setSearch] = useState("");
    const searchRef = useRef<HTMLInputElement>(null);
    const allRef = useRef<HTMLInputElement>(null);
    const id = useId();
    const matching = useMemo(() => matchingValues(list, search, texts.blanks), [list, search, texts.blanks]);
    const selected = useMemo(() => selectedValues(model, list), [model, list]);
    const onCount = matching.filter(value => selected.has(value)).length;
    const allChecked = matching.length > 0 && onCount === matching.length;
    const someChecked = onCount > 0 && !allChecked;
    useEffect(() => {
        if (allRef.current) {
            allRef.current.indeterminate = someChecked;
        }
    }, [someChecked]);
    useEffect(() => {
        if (props.autoFocus) {
            searchRef.current?.focus();
        }
    }, [props.autoFocus]);
    const shown = matching.slice(0, MAX_LISTED_VALUES);

    return (
        <div className="mxt-ag-set" role="group" aria-label={`${props.columnName} ${texts.filters}`}>
            <input
                ref={searchRef}
                type="search"
                className="form-control mxt-ag-set__search"
                placeholder={texts.search}
                aria-label={texts.searchValues}
                value={search}
                onChange={event => setSearch(event.target.value)}
            />
            <label className="mxt-ag-set__item mxt-ag-set__item--all">
                <input
                    ref={allRef}
                    type="checkbox"
                    checked={allChecked}
                    disabled={matching.length === 0}
                    aria-checked={someChecked ? "mixed" : allChecked}
                    onChange={() => onChange(toggleAllMatching(model, matching, list))}
                />
                <span>{texts.selectAll}</span>
            </label>
            <div className="mxt-ag-set__list" id={`${id}-list`}>
                {shown.map(value => (
                    <label key={value === BLANK_VALUE ? "\u0000blank" : value} className="mxt-ag-set__item">
                        <input
                            type="checkbox"
                            checked={selected.has(value)}
                            onChange={() => onChange(toggleSetValue(model, value, list))}
                        />
                        <span className={value === BLANK_VALUE ? "mxt-ag-set__blank" : undefined}>
                            {value === BLANK_VALUE ? texts.blanks : value}
                        </span>
                    </label>
                ))}
                {matching.length === 0 && <div className="mxt-ag-set__empty">{texts.noMatches}</div>}
                {matching.length > shown.length && (
                    <div className="mxt-ag-set__empty">
                        {texts.tooManyValues.replace("[count]", String(MAX_LISTED_VALUES))}
                    </div>
                )}
            </div>
        </div>
    );
}

type FilterProps = CustomFilterProps<GridRow, unknown, SetFilterModel> & SetFilterParams;

/** AG Grid custom filter (column menu) backed by the set filter model. */
export function SetColumnFilter(props: FilterProps): ReactElement {
    const { model, onModelChange, colId } = props;
    // A new callback per model, so AG Grid filters with the current choice.
    const doesFilterPass = useCallback(
        (params: IDoesFilterPassParams<GridRow>) => {
            const current = model;
            if (!isSetFilterModel(current)) {
                return true;
            }
            const row = params.data;
            if (!row || row.group || row.totals || row.detail) {
                return true;
            }
            return setFilterPasses(current, row.cells[colId]?.display ?? "");
        },
        [colId, model]
    );
    useGridFilter({ doesFilterPass });
    const list = useMemo(() => columnValues(props.api, props), [props]);
    return (
        <div className="mxt-ag-set-popup">
            <SetFilterPanel
                list={list}
                model={isSetFilterModel(model) ? model : null}
                onChange={onModelChange}
                texts={props.texts()}
                columnName={props.colDef.headerName ?? ""}
                autoFocus
            />
        </div>
    );
}

type FloatingProps = CustomFloatingFilterProps<unknown, GridRow, unknown, SetFilterModel> & SetFilterParams;

/** Floating filter: a button with the current choice that opens the checklist. */
export function SetFloatingFilter(props: FloatingProps): ReactElement {
    const { model, onModelChange } = props;
    const texts = props.texts();
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [list, setList] = useState<DistinctValues>({ values: [], hasBlanks: false });
    const [scope, setScope] = useState({ dark: false, rtl: false });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const current = isSetFilterModel(model) ? model : null;
    const columnName = props.column.getColDef().headerName ?? "";

    useEffect(() => {
        if (!open) {
            return;
        }
        const outside = (event: MouseEvent): void => {
            const target = event.target as Node;
            if (!popupRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
                setOpen(false);
            }
        };
        const escape = (event: KeyboardEvent): void => {
            if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener("mousedown", outside);
        document.addEventListener("keydown", escape, true);
        return () => {
            document.removeEventListener("mousedown", outside);
            document.removeEventListener("keydown", escape, true);
        };
    }, [open]);

    const toggle = (): void => {
        if (!open) {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (rect) {
                const width = 260;
                const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
                setPosition({ top: rect.bottom + window.scrollY + 2, left: left + window.scrollX });
            }
            setList(columnValues(props.api, props));
            // The popover lives in document.body: carry the grid's color scheme and direction over.
            const grid = buttonRef.current?.closest(".mxt-ag-grid");
            setScope({
                dark: Boolean(grid?.classList.contains("mxt-ag-grid--dark")),
                rtl: grid ? getComputedStyle(grid).direction === "rtl" : false
            });
        }
        setOpen(!open);
    };
    const summary = setFilterSummary(current, list.values.length + (list.hasBlanks ? 1 : 0), texts.blanks);
    const summaryText = current ? summary || `0 / ${list.values.length}` : "";

    return (
        <div className="filter-container mxt-ag-set-floating">
            <button
                ref={buttonRef}
                type="button"
                className={`form-control mxt-ag-set-floating__button${current ? " is-active" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={`${columnName} ${texts.filters}${summaryText ? `: ${summaryText}` : ""}`}
                onClick={toggle}
            >
                <span className="mxt-ag-set-floating__text">{summaryText || texts.selectAll}</span>
                <ChevronIcon className="mxt-ag-set-floating__chevron" />
            </button>
            {open &&
                createPortal(
                    <div
                        ref={popupRef}
                        className={`mxt-ag-set-popover${scope.dark ? " mxt-ag-set-popover--dark" : ""}`}
                        dir={scope.rtl ? "rtl" : undefined}
                        role="dialog"
                        aria-label={`${columnName} ${texts.filters}`}
                        style={{ position: "absolute", top: position.top, left: position.left }}
                    >
                        <SetFilterPanel
                            list={list}
                            model={current}
                            onChange={next => onModelChange(next)}
                            texts={texts}
                            columnName={columnName}
                            autoFocus
                        />
                    </div>,
                    document.body
                )}
        </div>
    );
}
