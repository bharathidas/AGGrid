import { DragEvent, KeyboardEvent, ReactElement, useEffect, useId, useRef, useState } from "react";
import classNames from "classnames";

import { AGGREGATE_FNS, AggregateFn } from "../utils/totals";
import type { PivotState } from "../utils/pivot";
import type { DistinctValues, SetFilterModel } from "../utils/setFilter";
import { UiTexts, aggregateLabel } from "../utils/texts";
import { SetFilterPanel } from "./SetFilter";
import { ArrowDownIcon, ArrowUpIcon, ChevronIcon, ClearIcon } from "./Icons";
import { moveMenuFocus } from "./usePopover";

export type SidePanelTab = "columns" | "filters";

export interface PanelColumn {
    id: string;
    name: string;
    visible: boolean;
    groupable: boolean;
    pivotable: boolean;
    /** Holds numbers (sum and average make sense). */
    numeric: boolean;
}

export type ConditionKind = "text" | "number" | "date";

export interface PanelFilter {
    id: string;
    name: string;
    active: boolean;
    /** Set filter columns: the checklist. */
    set?: { list: () => DistinctValues; model: SetFilterModel | null };
    /** Other columns: a condition (operator + value). */
    condition?: { kind: ConditionKind; type: string; value: string };
}

export interface SidePanelProps {
    title: string;
    texts: UiTexts;
    operatorLabel: (type: string) => string;
    tab: SidePanelTab;
    onTab: (tab: SidePanelTab) => void;
    onClose: () => void;
    columns: PanelColumn[];
    onToggleVisible: (id: string, visible: boolean) => void;
    /** Moves a column to the position of another column (display order). */
    onMove: (id: string, beforeId: string | undefined) => void;
    /** Row grouping available (outside pivot mode). */
    groupingEnabled: boolean;
    groupBy: string[];
    maxGroupLevels: number;
    onGroupBy: (next: string[]) => void;
    pivotEnabled: boolean;
    pivot: PivotState;
    onPivot: (next: PivotState) => void;
    filters: PanelFilter[];
    onSetFilter: (id: string, model: SetFilterModel | null) => void;
    onCondition: (id: string, kind: ConditionKind, type: string, value: string) => void;
    onClearFilter: (id: string) => void;
}

type Zone = "rows" | "columns" | "values";
const DRAG_TYPE = "application/x-mxt-ag-column";

const OPERATORS: Record<ConditionKind, string[]> = {
    text: ["contains", "notContains", "equals", "notEqual", "startsWith", "endsWith", "blank", "notBlank"],
    number: [
        "equals",
        "notEqual",
        "greaterThan",
        "greaterThanOrEqual",
        "lessThan",
        "lessThanOrEqual",
        "blank",
        "notBlank"
    ],
    date: ["equals", "lessThan", "greaterThan", "blank", "notBlank"]
};
const VALUELESS = new Set(["blank", "notBlank"]);

function move<T>(list: T[], index: number, delta: number): T[] {
    const target = index + delta;
    if (index < 0 || target < 0 || target >= list.length) {
        return list;
    }
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

/** Tool panel next to the grid: columns (visibility, order, grouping and pivot zones) and filters. */
export function SidePanel(props: SidePanelProps): ReactElement {
    const { texts, tab } = props;
    const id = useId();
    const tabs: SidePanelTab[] = ["columns", "filters"];
    const tabLabel = (value: SidePanelTab): string => (value === "columns" ? texts.columns : texts.filters);
    const activeFilters = props.filters.filter(filter => filter.active).length;

    const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
            return;
        }
        event.preventDefault();
        const next = tab === "columns" ? "filters" : "columns";
        props.onTab(next);
        window.requestAnimationFrame(() => document.getElementById(`${id}-tab-${next}`)?.focus());
    };

    return (
        <aside className="mxt-ag-panel" aria-label={props.title}>
            <div className="mxt-ag-panel__head">
                <div className="mxt-ag-panel__tabs" role="tablist" aria-label={props.title}>
                    {tabs.map(value => (
                        <button
                            key={value}
                            id={`${id}-tab-${value}`}
                            type="button"
                            role="tab"
                            aria-selected={tab === value}
                            aria-controls={`${id}-panel`}
                            tabIndex={tab === value ? 0 : -1}
                            className={classNames("mxt-ag-panel__tab", { "is-active": tab === value })}
                            onClick={() => props.onTab(value)}
                            onKeyDown={handleTabKey}
                        >
                            {tabLabel(value)}
                            {value === "filters" && activeFilters > 0 && (
                                <span
                                    className="mxt-ag-panel__badge"
                                    aria-label={`${activeFilters} ${texts.filterActive}`}
                                >
                                    {activeFilters}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className="mxt-ag-icon-btn mxt-ag-panel__close"
                    aria-label={texts.close}
                    title={texts.close}
                    onClick={props.onClose}
                >
                    <ClearIcon />
                </button>
            </div>
            <div className="mxt-ag-panel__body" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`}>
                {tab === "columns" ? <ColumnsSection {...props} /> : <FiltersSection {...props} />}
            </div>
        </aside>
    );
}

function ColumnsSection(props: SidePanelProps): ReactElement {
    const { texts, pivot } = props;
    const [search, setSearch] = useState("");
    const [dragOver, setDragOver] = useState<string | undefined>(undefined);
    const [menuFor, setMenuFor] = useState<string | undefined>(undefined);
    const pivotOn = props.pivotEnabled && pivot.active;
    const nameOf = (colId: string): string => props.columns.find(column => column.id === colId)?.name ?? colId;
    const needle = search.trim().toLocaleLowerCase();
    const shown = props.columns.filter(column => !needle || column.name.toLocaleLowerCase().includes(needle));

    const rowZone = pivotOn ? pivot.rows : props.groupBy;
    const setRowZone = (next: string[]): void => {
        if (pivotOn) {
            props.onPivot({ ...pivot, rows: next });
        } else {
            props.onGroupBy(next.slice(0, props.maxGroupLevels));
        }
    };
    const addTo = (zone: Zone, colId: string): void => {
        const column = props.columns.find(entry => entry.id === colId);
        if (!column) {
            return;
        }
        if (zone === "rows") {
            if (!rowZone.includes(colId) && (pivotOn ? column.pivotable : column.groupable)) {
                setRowZone([...rowZone, colId]);
            }
        } else if (zone === "columns") {
            if (!pivot.columns.includes(colId) && column.pivotable) {
                props.onPivot({ ...pivot, columns: [...pivot.columns, colId] });
            }
        } else if (column.pivotable && !pivot.values.some(value => value.colId === colId)) {
            const fn: AggregateFn = column.numeric ? "sum" : "count";
            props.onPivot({ ...pivot, values: [...pivot.values, { colId, fn }] });
        }
    };
    const showRowZone = props.groupingEnabled || pivotOn;

    const onDragStart = (event: DragEvent<HTMLElement>, colId: string): void => {
        event.dataTransfer.setData(DRAG_TYPE, colId);
        event.dataTransfer.setData("text/plain", colId);
        event.dataTransfer.effectAllowed = "copyMove";
    };
    const draggedId = (event: DragEvent<HTMLElement>): string =>
        event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain");

    return (
        <div className="mxt-ag-panel__section">
            {props.pivotEnabled && (
                <label className="mxt-ag-panel__switch">
                    <input
                        type="checkbox"
                        role="switch"
                        checked={pivot.active}
                        onChange={event => props.onPivot({ ...pivot, active: event.target.checked })}
                    />
                    <span>{texts.pivotMode}</span>
                </label>
            )}
            <input
                type="search"
                className="form-control mxt-ag-panel__search"
                placeholder={texts.search}
                aria-label={`${texts.columns}: ${texts.search}`}
                value={search}
                onChange={event => setSearch(event.target.value)}
            />
            <ul className="mxt-ag-panel__columns" aria-label={texts.columns}>
                {shown.map((column, index) => (
                    <li
                        key={column.id}
                        className={classNames("mxt-ag-panel__column", { "is-drop": dragOver === column.id })}
                        draggable={!needle}
                        onDragStart={event => onDragStart(event, column.id)}
                        onDragOver={event => {
                            if (!needle) {
                                event.preventDefault();
                                setDragOver(column.id);
                            }
                        }}
                        onDragLeave={() => setDragOver(undefined)}
                        onDrop={event => {
                            event.preventDefault();
                            setDragOver(undefined);
                            const moving = draggedId(event);
                            if (moving && moving !== column.id) {
                                props.onMove(moving, column.id);
                            }
                        }}
                    >
                        <span className="mxt-ag-panel__grip" aria-hidden="true">
                            ⋮⋮
                        </span>
                        <label className="mxt-ag-panel__check">
                            <input
                                type="checkbox"
                                checked={column.visible}
                                onChange={event => props.onToggleVisible(column.id, event.target.checked)}
                                onKeyDown={event => {
                                    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                                        event.preventDefault();
                                        const target = event.key === "ArrowUp" ? shown[index - 1] : shown[index + 2];
                                        if (event.key === "ArrowUp" && !target) {
                                            return;
                                        }
                                        props.onMove(column.id, target?.id);
                                    }
                                }}
                                aria-describedby={undefined}
                            />
                            <span>{column.name || column.id}</span>
                        </label>
                        <ColumnActions
                            column={column}
                            texts={texts}
                            open={menuFor === column.id}
                            onOpenChange={open => setMenuFor(open ? column.id : undefined)}
                            canUp={index > 0 && !needle}
                            canDown={index < shown.length - 1 && !needle}
                            onUp={() => props.onMove(column.id, shown[index - 1]?.id)}
                            onDown={() => props.onMove(column.id, shown[index + 2]?.id)}
                            zones={[
                                ...(showRowZone &&
                                (pivotOn ? column.pivotable : column.groupable) &&
                                !rowZone.includes(column.id)
                                    ? [{ zone: "rows" as Zone, label: texts.rowGroups }]
                                    : []),
                                ...(pivotOn && column.pivotable && !pivot.columns.includes(column.id)
                                    ? [{ zone: "columns" as Zone, label: texts.columnLabels }]
                                    : []),
                                ...(pivotOn &&
                                column.pivotable &&
                                !pivot.values.some(value => value.colId === column.id)
                                    ? [{ zone: "values" as Zone, label: texts.values }]
                                    : [])
                            ]}
                            onAdd={zone => addTo(zone, column.id)}
                        />
                    </li>
                ))}
            </ul>
            {showRowZone && (
                <DropZone
                    title={texts.rowGroups}
                    empty={texts.rowGroupsEmpty}
                    texts={texts}
                    items={rowZone.map(colId => ({ colId, name: nameOf(colId) }))}
                    onDrop={colId => addTo("rows", colId)}
                    onRemove={colId => setRowZone(rowZone.filter(entry => entry !== colId))}
                    onMove={(colId, delta) => setRowZone(move(rowZone, rowZone.indexOf(colId), delta))}
                    draggedId={draggedId}
                />
            )}
            {pivotOn && (
                <DropZone
                    title={texts.columnLabels}
                    empty={texts.columnLabelsEmpty}
                    texts={texts}
                    items={pivot.columns.map(colId => ({ colId, name: nameOf(colId) }))}
                    onDrop={colId => addTo("columns", colId)}
                    onRemove={colId =>
                        props.onPivot({ ...pivot, columns: pivot.columns.filter(entry => entry !== colId) })
                    }
                    onMove={(colId, delta) =>
                        props.onPivot({ ...pivot, columns: move(pivot.columns, pivot.columns.indexOf(colId), delta) })
                    }
                    draggedId={draggedId}
                />
            )}
            {pivotOn && (
                <DropZone
                    title={texts.values}
                    empty={texts.valuesEmpty}
                    texts={texts}
                    items={pivot.values.map(value => ({ colId: value.colId, name: nameOf(value.colId), fn: value.fn }))}
                    onDrop={colId => addTo("values", colId)}
                    onRemove={colId =>
                        props.onPivot({ ...pivot, values: pivot.values.filter(value => value.colId !== colId) })
                    }
                    onMove={(colId, delta) =>
                        props.onPivot({
                            ...pivot,
                            values: move(
                                pivot.values,
                                pivot.values.findIndex(value => value.colId === colId),
                                delta
                            )
                        })
                    }
                    onFn={(colId, fn) =>
                        props.onPivot({
                            ...pivot,
                            values: pivot.values.map(value => (value.colId === colId ? { ...value, fn } : value))
                        })
                    }
                    fnsFor={colId =>
                        props.columns.find(column => column.id === colId)?.numeric
                            ? AGGREGATE_FNS
                            : (["count", "distinctCount", "min", "max"] as AggregateFn[])
                    }
                    draggedId={draggedId}
                />
            )}
        </div>
    );
}

interface ColumnActionsProps {
    column: PanelColumn;
    texts: UiTexts;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    canUp: boolean;
    canDown: boolean;
    onUp: () => void;
    onDown: () => void;
    zones: Array<{ zone: Zone; label: string }>;
    onAdd: (zone: Zone) => void;
}

/** "More" button of a column: move up / down and add to a drop zone (the keyboard way to drag). */
function ColumnActions(props: ColumnActionsProps): ReactElement {
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    const { open, onOpenChange } = props;
    useEffect(() => {
        if (!open) {
            return;
        }
        const outside = (event: MouseEvent): void => {
            if (!root.current?.contains(event.target as Node)) {
                onOpenChange(false);
            }
        };
        document.addEventListener("mousedown", outside);
        const frame = window.requestAnimationFrame(() =>
            root.current?.querySelector<HTMLElement>("[data-menuitem]:not([disabled])")?.focus()
        );
        return () => {
            document.removeEventListener("mousedown", outside);
            window.cancelAnimationFrame(frame);
        };
    }, [open, onOpenChange]);
    const close = (): void => {
        onOpenChange(false);
        button.current?.focus();
    };
    const run = (action: () => void): void => {
        action();
        close();
    };
    return (
        <div className="mxt-ag-menu-root mxt-ag-panel__actions" ref={root}>
            <button
                ref={button}
                type="button"
                className="mxt-ag-icon-btn"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${props.column.name}: ${props.texts.addTo}`}
                title={props.texts.addTo}
                onClick={() => onOpenChange(!open)}
            >
                <span aria-hidden="true">⋯</span>
            </button>
            {open && (
                <div
                    className="mxt-ag-menu mxt-ag-panel__menu"
                    role="menu"
                    aria-label={props.column.name}
                    onKeyDown={event => {
                        if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            close();
                        } else if (moveMenuFocus(event.currentTarget, event.key)) {
                            event.preventDefault();
                        }
                    }}
                >
                    <button
                        type="button"
                        role="menuitem"
                        data-menuitem
                        className="mxt-ag-menu__item"
                        disabled={!props.canUp}
                        onClick={() => run(props.onUp)}
                    >
                        <ArrowUpIcon />
                        <span className="mxt-ag-menu__name">{props.texts.moveUp}</span>
                    </button>
                    <button
                        type="button"
                        role="menuitem"
                        data-menuitem
                        className="mxt-ag-menu__item"
                        disabled={!props.canDown}
                        onClick={() => run(props.onDown)}
                    >
                        <ArrowDownIcon />
                        <span className="mxt-ag-menu__name">{props.texts.moveDown}</span>
                    </button>
                    {props.zones.map(entry => (
                        <button
                            key={entry.zone}
                            type="button"
                            role="menuitem"
                            data-menuitem
                            className="mxt-ag-menu__item"
                            data-zone={entry.zone}
                            onClick={() => run(() => props.onAdd(entry.zone))}
                        >
                            <span className="mxt-ag-menu__check" aria-hidden="true">
                                +
                            </span>
                            <span className="mxt-ag-menu__name">
                                {props.texts.addTo}: {entry.label}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface DropZoneProps {
    title: string;
    empty: string;
    texts: UiTexts;
    items: Array<{ colId: string; name: string; fn?: AggregateFn }>;
    onDrop: (colId: string) => void;
    onRemove: (colId: string) => void;
    onMove: (colId: string, delta: -1 | 1) => void;
    onFn?: (colId: string, fn: AggregateFn) => void;
    fnsFor?: (colId: string) => AggregateFn[];
    draggedId: (event: DragEvent<HTMLElement>) => string;
}

function DropZone(props: DropZoneProps): ReactElement {
    const [over, setOver] = useState(false);
    const titleId = useId();
    const { texts } = props;
    return (
        <section
            className={classNames("mxt-ag-panel__zone", { "is-over": over })}
            aria-labelledby={titleId}
            onDragOver={event => {
                event.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={event => {
                event.preventDefault();
                setOver(false);
                const colId = props.draggedId(event);
                if (colId) {
                    props.onDrop(colId);
                }
            }}
        >
            <h4 className="mxt-ag-panel__zone-title" id={titleId}>
                {props.title}
            </h4>
            {props.items.length === 0 ? (
                <p className="mxt-ag-panel__zone-empty">{props.empty}</p>
            ) : (
                <ol className="mxt-ag-panel__chips">
                    {props.items.map((entry, index) => (
                        <li key={entry.colId} className="mxt-ag-panel__chip">
                            <span className="mxt-ag-panel__chip-name">{entry.name}</span>
                            {entry.fn && props.onFn && (
                                <select
                                    className="mxt-ag-panel__fn"
                                    aria-label={`${entry.name}: ${texts.values}`}
                                    value={entry.fn}
                                    onChange={event => props.onFn?.(entry.colId, event.target.value as AggregateFn)}
                                >
                                    {(props.fnsFor?.(entry.colId) ?? AGGREGATE_FNS).map(fn => (
                                        <option key={fn} value={fn}>
                                            {aggregateLabel(texts, fn)}
                                        </option>
                                    ))}
                                </select>
                            )}
                            <button
                                type="button"
                                className="mxt-ag-icon-btn"
                                aria-label={`${entry.name}: ${texts.moveUp}`}
                                title={texts.moveUp}
                                disabled={index === 0}
                                onClick={() => props.onMove(entry.colId, -1)}
                            >
                                <ArrowUpIcon />
                            </button>
                            <button
                                type="button"
                                className="mxt-ag-icon-btn"
                                aria-label={`${entry.name}: ${texts.moveDown}`}
                                title={texts.moveDown}
                                disabled={index === props.items.length - 1}
                                onClick={() => props.onMove(entry.colId, 1)}
                            >
                                <ArrowDownIcon />
                            </button>
                            <button
                                type="button"
                                className="mxt-ag-icon-btn mxt-ag-icon-btn--danger"
                                aria-label={`${entry.name}: ${texts.remove}`}
                                title={texts.remove}
                                onClick={() => props.onRemove(entry.colId)}
                            >
                                <ClearIcon />
                            </button>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

function FiltersSection(props: SidePanelProps): ReactElement {
    const [openIds, setOpenIds] = useState<Set<string>>(
        () => new Set(props.filters.filter(f => f.active).map(f => f.id))
    );
    const toggle = (filterId: string): void =>
        setOpenIds(previous => {
            const next = new Set(previous);
            if (next.has(filterId)) {
                next.delete(filterId);
            } else {
                next.add(filterId);
            }
            return next;
        });
    return (
        <div className="mxt-ag-panel__section">
            {props.filters.length === 0 && <p className="mxt-ag-panel__zone-empty">{props.texts.noMatches}</p>}
            {props.filters.map(filter => (
                <FilterItem
                    key={filter.id}
                    filter={filter}
                    open={openIds.has(filter.id)}
                    onToggle={() => toggle(filter.id)}
                    {...props}
                />
            ))}
        </div>
    );
}

function FilterItem(
    props: SidePanelProps & { filter: PanelFilter; open: boolean; onToggle: () => void }
): ReactElement {
    const { filter, texts } = props;
    const bodyId = useId();
    return (
        <div className={classNames("mxt-ag-panel__filter", { "is-active": filter.active })}>
            <div className="mxt-ag-panel__filter-head">
                <button
                    type="button"
                    className="mxt-ag-panel__filter-toggle"
                    aria-expanded={props.open}
                    aria-controls={props.open ? bodyId : undefined}
                    onClick={props.onToggle}
                >
                    <ChevronIcon className={props.open ? "mxt-ag-panel__chevron is-open" : "mxt-ag-panel__chevron"} />
                    <span>{filter.name}</span>
                    {filter.active && <span className="mxt-ag-panel__dot" aria-label={texts.filterActive} role="img" />}
                </button>
                {filter.active && (
                    <button
                        type="button"
                        className="btn btn-link btn-sm mxt-ag-panel__clear"
                        onClick={() => props.onClearFilter(filter.id)}
                        aria-label={`${filter.name}: ${texts.clear}`}
                    >
                        {texts.clear}
                    </button>
                )}
            </div>
            {props.open && (
                <div className="mxt-ag-panel__filter-body" id={bodyId}>
                    {filter.set ? (
                        <SetFilterPanel
                            list={filter.set.list()}
                            model={filter.set.model}
                            onChange={model => props.onSetFilter(filter.id, model)}
                            texts={texts}
                            columnName={filter.name}
                        />
                    ) : filter.condition ? (
                        <ConditionEditor
                            name={filter.name}
                            condition={filter.condition}
                            operatorLabel={props.operatorLabel}
                            onChange={(type, value) =>
                                props.onCondition(filter.id, filter.condition?.kind ?? "text", type, value)
                            }
                        />
                    ) : null}
                </div>
            )}
        </div>
    );
}

function ConditionEditor(props: {
    name: string;
    condition: { kind: ConditionKind; type: string; value: string };
    operatorLabel: (type: string) => string;
    onChange: (type: string, value: string) => void;
}): ReactElement {
    const { condition } = props;
    const operators = OPERATORS[condition.kind];
    const [type, setType] = useState(operators.includes(condition.type) ? condition.type : operators[0]);
    const [value, setValue] = useState(condition.value);
    const timer = useRef<number | undefined>(undefined);
    // Follow changes made elsewhere (floating filter, reset, view).
    const [synced, setSynced] = useState(condition);
    if (synced.type !== condition.type || synced.value !== condition.value) {
        setSynced(condition);
        setValue(condition.value);
        if (operators.includes(condition.type)) {
            setType(condition.type);
        }
    }
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const push = (nextType: string, nextValue: string, delay: number): void => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => props.onChange(nextType, nextValue), delay);
    };
    return (
        <div className="mxt-ag-panel__condition">
            <select
                className="form-control"
                aria-label={`${props.name}: operator`}
                value={type}
                onChange={event => {
                    setType(event.target.value);
                    push(event.target.value, value, 0);
                }}
            >
                {operators.map(operator => (
                    <option key={operator} value={operator}>
                        {props.operatorLabel(operator)}
                    </option>
                ))}
            </select>
            {!VALUELESS.has(type) && (
                <input
                    className="form-control"
                    type={condition.kind === "date" ? "date" : "text"}
                    inputMode={condition.kind === "number" ? "decimal" : undefined}
                    aria-label={`${props.name}: ${props.operatorLabel(type)}`}
                    value={value}
                    onChange={event => {
                        setValue(event.target.value);
                        push(type, event.target.value, 300);
                    }}
                />
            )}
        </div>
    );
}
