import type { CellData, GridRow } from "./rows";
import { AggregateFn, aggregateValues, isAggregateChoice } from "./totals";
import { CollapseState, compareGroupValues, isCollapsed } from "./grouping";

/**
 * Pivot tables for the browser row model, built on AG Grid Community (pivoting is an AG Grid Enterprise feature).
 * `computePivot` turns the filtered data rows into hierarchical rows (one per row-group path, with subtotals)
 * and generated value columns (one per distinct combination of the column-label values and value field), plus a
 * total column per value and a grand total row. The result is plain GridRows, so the pivot grid reuses the
 * group cell renderer and the Excel writer.
 */

export const PIVOT_ROW_PREFIX = "__mxt_pivot__:";
export const PIVOT_GROUP_COLUMN_ID = "__mxt_pivot_group__";
export const PIVOT_GRAND_TOTAL_ID = "__mxt_pivot_total__";
export const MAX_PIVOT_COLUMNS = 400;

export interface PivotValue {
    colId: string;
    fn: AggregateFn;
}

export interface PivotConfig {
    /** Row group column ids, outermost first. */
    rows: string[];
    /** Column label column ids, outermost first. */
    columns: string[];
    values: PivotValue[];
}

export interface PivotState extends PivotConfig {
    active: boolean;
}

export interface PivotFieldInfo {
    caption: (colId: string) => string;
    /** Formats an aggregated number of a value field. */
    format: (colId: string, fn: AggregateFn, value: number) => string;
    /** Text of the aggregation, e.g. "Sum". */
    fnLabel: (fn: AggregateFn) => string;
}

export interface PivotColumnSpec {
    id: string;
    /** Labels of the column-label values, outermost first (empty for total columns). */
    keys: string[];
    valueIndex: number;
    /** Leaf header: "Sum of Salary". */
    header: string;
    total?: boolean;
    /** Index of the column-label combination (-1 for total columns). */
    combo: number;
}

export interface PivotResult {
    columns: PivotColumnSpec[];
    /** Every pivot row (all levels) in natural order; group.path holds the JSON of the keys. */
    rows: GridRow[];
    grandTotal?: GridRow;
    /** More distinct column-label combinations than MAX_PIVOT_COLUMNS; the rest were left out. */
    truncated: boolean;
}

export function emptyPivot(): PivotState {
    return { active: false, rows: [], columns: [], values: [] };
}

export function isPivotConfigEmpty(config: PivotConfig): boolean {
    return config.rows.length === 0 && config.columns.length === 0 && config.values.length === 0;
}

/** Reads a remembered pivot state; anything unreadable yields undefined. */
export function sanitizePivot(value: unknown, valid: (colId: string) => boolean): PivotState | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const raw = value as Record<string, unknown>;
    const ids = (list: unknown): string[] =>
        Array.isArray(list)
            ? list
                  .filter((id): id is string => typeof id === "string" && valid(id))
                  .filter((id, i, a) => a.indexOf(id) === i)
            : [];
    const values = Array.isArray(raw.values)
        ? (raw.values as unknown[])
              .map(entry => entry as Record<string, unknown>)
              .filter(
                  entry =>
                      entry &&
                      typeof entry.colId === "string" &&
                      valid(entry.colId) &&
                      isAggregateChoice(entry.fn) &&
                      entry.fn !== "none"
              )
              .map(entry => ({ colId: entry.colId as string, fn: entry.fn as AggregateFn }))
        : [];
    return { active: raw.active === true, rows: ids(raw.rows), columns: ids(raw.columns), values };
}

function displayOf(row: GridRow, colId: string): string {
    return row.cells[colId]?.display ?? "";
}

interface KeyInfo {
    label: string;
    sample: unknown;
}

function sortKeys(entries: Map<string, KeyInfo>): string[] {
    return Array.from(entries.entries())
        .sort(([, a], [, b]) => compareGroupValues(a.sample, b.sample) || a.label.localeCompare(b.label))
        .map(([key]) => key);
}

/** Pivot row id for a row-group path. */
export function pivotRowId(path: string): string {
    return PIVOT_ROW_PREFIX + path;
}

export function computePivot(
    rows: GridRow[],
    config: PivotConfig,
    info: PivotFieldInfo,
    options: { totals: boolean; totalLabel: string; emptyLabel: string }
): PivotResult {
    const values: PivotValue[] = config.values.length > 0 ? config.values : [];
    const valueCount = Math.max(1, values.length);
    // A pivot without value fields counts the rows.
    const effectiveValues: Array<PivotValue | undefined> = values.length > 0 ? values : [undefined];

    // ---- Column-label combinations ----------------------------------------------------------------
    const comboOf = new Map<GridRow, string>();
    const comboLabels = new Map<string, string[]>();
    const comboSamples = new Map<string, unknown[]>();
    rows.forEach(row => {
        const labels = config.columns.map(colId => displayOf(row, colId) || options.emptyLabel);
        const key = JSON.stringify(labels);
        comboOf.set(row, key);
        if (!comboLabels.has(key)) {
            comboLabels.set(key, labels);
            comboSamples.set(
                key,
                config.columns.map(colId => row.cells[colId]?.value)
            );
        }
    });
    let combos = Array.from(comboLabels.keys()).sort((a, b) => {
        const sa = comboSamples.get(a) as unknown[];
        const sb = comboSamples.get(b) as unknown[];
        for (let i = 0; i < sa.length; i++) {
            const result = compareGroupValues(sa[i], sb[i]);
            if (result !== 0) {
                return result;
            }
            const la = (comboLabels.get(a) as string[])[i];
            const lb = (comboLabels.get(b) as string[])[i];
            if (la !== lb) {
                return la.localeCompare(lb);
            }
        }
        return 0;
    });
    const maxCombos = Math.max(1, Math.floor(MAX_PIVOT_COLUMNS / valueCount));
    const truncated = combos.length > maxCombos;
    if (truncated) {
        combos = combos.slice(0, maxCombos);
    }
    const comboIndex = new Map(combos.map((key, index) => [key, index]));

    const valueHeader = (value: PivotValue | undefined): string =>
        value ? `${info.fnLabel(value.fn)}(${info.caption(value.colId)})` : info.fnLabel("count");
    const columns: PivotColumnSpec[] = [];
    if (config.columns.length > 0) {
        combos.forEach((key, comboPosition) => {
            effectiveValues.forEach((value, valueIndex) =>
                columns.push({
                    id: `p${comboPosition}_${valueIndex}`,
                    keys: comboLabels.get(key) as string[],
                    valueIndex,
                    header: valueHeader(value),
                    combo: comboPosition
                })
            );
        });
    }
    if (config.columns.length === 0 || options.totals) {
        effectiveValues.forEach((value, valueIndex) =>
            columns.push({
                id: `pt_${valueIndex}`,
                keys: [],
                valueIndex,
                header:
                    config.columns.length === 0 ? valueHeader(value) : `${options.totalLabel} ${valueHeader(value)}`,
                total: true,
                combo: -1
            })
        );
    }

    // ---- Buckets: values per (row path, column combination) ---------------------------------------
    interface Bucket {
        count: number;
        /** values[combo or -1 for total][valueIndex] = raw values. */
        cells: Map<number, unknown[][]>;
        sample: unknown;
        label: string;
    }
    const newBucket = (label: string, sample: unknown): Bucket => ({ count: 0, cells: new Map(), sample, label });
    const add = (bucket: Bucket, combo: number, row: GridRow): void => {
        let lists = bucket.cells.get(combo);
        if (!lists) {
            lists = effectiveValues.map(() => []);
            bucket.cells.set(combo, lists);
        }
        effectiveValues.forEach((value, index) => {
            (lists as unknown[][])[index].push(value ? row.cells[value.colId]?.value : 1);
        });
    };
    const buckets = new Map<string, Bucket>();
    const keyInfos = new Map<string, Map<string, KeyInfo>>();
    const grand = newBucket(options.totalLabel, undefined);
    rows.forEach(row => {
        const combo = comboIndex.get(comboOf.get(row) as string);
        const keys: string[] = [];
        const targets: Bucket[] = [grand];
        config.rows.forEach(colId => {
            const parentPath = JSON.stringify(keys);
            const label = displayOf(row, colId) || options.emptyLabel;
            keys.push(label);
            const path = JSON.stringify(keys);
            let bucket = buckets.get(path);
            if (!bucket) {
                bucket = newBucket(label, row.cells[colId]?.value);
                buckets.set(path, bucket);
                let siblings = keyInfos.get(parentPath);
                if (!siblings) {
                    siblings = new Map();
                    keyInfos.set(parentPath, siblings);
                }
                siblings.set(path, { label, sample: row.cells[colId]?.value });
            }
            targets.push(bucket);
        });
        targets.forEach(bucket => {
            bucket.count++;
            if (combo !== undefined) {
                add(bucket, combo, row);
            }
            add(bucket, -1, row);
        });
    });

    const cellsOf = (bucket: Bucket): Record<string, CellData> => {
        const cells: Record<string, CellData> = {};
        columns.forEach(column => {
            const lists = bucket.cells.get(column.combo);
            const value = effectiveValues[column.valueIndex];
            const fn: AggregateFn = value ? value.fn : "count";
            const raw = lists ? aggregateValues(lists[column.valueIndex], fn) : undefined;
            cells[column.id] =
                raw === undefined || (lists && lists[column.valueIndex].length === 0)
                    ? { value: undefined, display: "", readOnly: true }
                    : {
                          value: raw,
                          display: info.format(value?.colId ?? "", fn, raw),
                          readOnly: true,
                          aggregate: fn
                      };
        });
        return cells;
    };

    // ---- Rows in natural (sorted) order -----------------------------------------------------------
    const result: GridRow[] = [];
    const visit = (parentKeys: string[]): void => {
        const siblings = keyInfos.get(JSON.stringify(parentKeys));
        if (!siblings) {
            return;
        }
        sortKeys(siblings).forEach(path => {
            const bucket = buckets.get(path) as Bucket;
            const keys = JSON.parse(path) as string[];
            const level = keys.length - 1;
            const colId = config.rows[level];
            result.push({
                id: pivotRowId(path),
                cells: cellsOf(bucket),
                group: {
                    level,
                    colId,
                    caption: info.caption(colId),
                    label: bucket.label,
                    path,
                    count: bucket.count
                }
            });
            if (keys.length < config.rows.length) {
                visit(keys);
            }
        });
    };
    visit([]);

    const grandRow: GridRow = {
        id: PIVOT_GRAND_TOTAL_ID,
        totals: true,
        cells: cellsOf(grand),
        group: { level: 0, colId: "", caption: "", label: options.totalLabel, path: "[]", count: grand.count }
    };
    if (config.rows.length === 0) {
        // Without row groups the pivot is one row: the grand total itself.
        return { columns, rows: [{ ...grandRow, totals: undefined, id: pivotRowId("[]") }], truncated };
    }
    return { columns, rows: result, grandTotal: options.totals ? grandRow : undefined, truncated };
}

/** Parent path of a pivot row path ("[\"A\",\"B\"]" -> "[\"A\"]"), undefined for top-level rows. */
export function parentPath(path: string): string | undefined {
    const keys = JSON.parse(path) as string[];
    return keys.length > 1 ? JSON.stringify(keys.slice(0, -1)) : undefined;
}

/**
 * Visible pivot rows: children of collapsed rows are left out, and siblings are sorted by a value column when
 * the user sorted the pivot (the hierarchy is kept).
 */
export function flattenPivot(
    rows: GridRow[],
    collapse: CollapseState,
    sort?: { colId: string; direction: "asc" | "desc" }
): GridRow[] {
    const children = new Map<string, GridRow[]>();
    rows.forEach(row => {
        const parent = row.group ? parentPath(row.group.path) ?? "" : "";
        const list = children.get(parent);
        if (list) {
            list.push(row);
        } else {
            children.set(parent, [row]);
        }
    });
    const ordered = (list: GridRow[]): GridRow[] => {
        if (!sort) {
            return list;
        }
        const factor = sort.direction === "desc" ? -1 : 1;
        const valueOf = (row: GridRow): unknown =>
            sort.colId === PIVOT_GROUP_COLUMN_ID ? row.group?.label : row.cells[sort.colId]?.value;
        return [...list].sort((a, b) => factor * compareGroupValues(valueOf(a), valueOf(b)));
    };
    const result: GridRow[] = [];
    const visit = (parent: string): void => {
        ordered(children.get(parent) ?? []).forEach(row => {
            result.push(row);
            const path = row.group?.path;
            if (path && children.has(path) && !isCollapsed(collapse, path)) {
                visit(path);
            }
        });
    };
    visit("");
    return result;
}

/** Header rows for an export: one row per column-label level plus the value header. */
export function pivotHeaderRows(result: PivotResult, levels: number, totalLabel: string): string[][] {
    const header: string[][] = [];
    for (let level = 0; level < levels; level++) {
        header.push(
            result.columns.map(column => (column.total ? (level === 0 ? totalLabel : "") : column.keys[level] ?? ""))
        );
    }
    header.push(result.columns.map(column => column.header));
    return header;
}
