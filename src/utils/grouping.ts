import type { ColumnsType } from "../../typings/AGGridProps";
import { GridRow, columnId } from "./rows";
import { computeTotalsFromRows } from "./totals";

/**
 * Row grouping for the browser row model, built on AG Grid Community (row grouping is an AG Grid Enterprise
 * feature). Group header rows are ordinary rows in the row data that always pass the filters; after AG Grid
 * filtered and sorted the rows, `arrangeGroups` puts every leaf row under its group header, drops empty groups
 * and the rows of collapsed groups, and computes the counts and aggregates of every group.
 */

export const GROUP_COLUMN_ID = "__mxt_group__";
export const MAX_GROUP_LEVELS = 3;
const GROUP_ROW_PREFIX = "__mxt_group__:";

export interface GroupInfo {
    /** 0 is the outermost level. */
    level: number;
    /** Column the group is based on. */
    colId: string;
    /** Column caption, e.g. "Department". */
    caption: string;
    /** Displayed value of the group, e.g. "Sales"; the empty label for rows without a value. */
    label: string;
    /** Unique key of the group: the values of this group and its parents. */
    path: string;
    /** Rows in the group that pass the filters (set by arrangeGroups). */
    count: number;
}

export type GroupDirection = "asc" | "desc";

/** Whether rows can be grouped by a column (custom content has no value). */
export function canGroupBy(column: ColumnsType | undefined): boolean {
    return Boolean(
        column &&
            column.columnType !== "customContent" &&
            (column.columnType === "dynamicText" || column.attribute) &&
            column.groupable !== false
    );
}

/** Group columns configured with "Group by level", outermost first (at most three). */
export function initialGroupBy(columns: ColumnsType[]): string[] {
    return columns
        .map((column, index) => ({ column, index }))
        .filter(entry => (entry.column.groupIndex ?? 0) > 0 && canGroupBy({ ...entry.column, groupable: true }))
        .sort((a, b) => (a.column.groupIndex ?? 0) - (b.column.groupIndex ?? 0) || a.index - b.index)
        .slice(0, MAX_GROUP_LEVELS)
        .map(entry => columnId(entry.index));
}

/** Drops unknown, duplicate and ungroupable column ids from a remembered grouping. */
export function sanitizeGroupBy(groupBy: unknown, columns: ColumnsType[]): string[] {
    if (!Array.isArray(groupBy)) {
        return [];
    }
    const result: string[] = [];
    groupBy.forEach(id => {
        const match = typeof id === "string" ? /^col(\d+)$/.exec(id) : null;
        const column = match ? columns[Number(match[1])] : undefined;
        if (match && column && column.columnType !== "customContent" && !result.includes(id as string)) {
            result.push(id as string);
        }
    });
    return result.slice(0, MAX_GROUP_LEVELS);
}

/** Adds a column to the grouping (as the innermost level) or removes it. */
export function toggleGroupBy(groupBy: string[], colId: string): string[] {
    if (groupBy.includes(colId)) {
        return groupBy.filter(id => id !== colId);
    }
    return groupBy.length >= MAX_GROUP_LEVELS ? groupBy : [...groupBy, colId];
}

/** Moves a grouped column one level up (-1) or down (+1). */
export function moveGroupBy(groupBy: string[], colId: string, delta: -1 | 1): string[] {
    const index = groupBy.indexOf(colId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= groupBy.length) {
        return groupBy;
    }
    const next = [...groupBy];
    next[index] = next[target];
    next[target] = colId;
    return next;
}

/** The value a row is grouped on: what the user sees in the cell. */
export function groupKey(row: GridRow, colId: string): string {
    return row.cells[colId]?.display ?? "";
}

export function pathFor(keys: string[]): string {
    return JSON.stringify(keys);
}

export function groupRowId(path: string): string {
    return GROUP_ROW_PREFIX + path;
}

export function isGroupRow(row: GridRow | undefined): boolean {
    return Boolean(row?.group);
}

/** One header row for every distinct group path among the rows (all levels). */
export function buildGroupRows(
    rows: GridRow[],
    groupBy: string[],
    captionOf: (colId: string) => string,
    emptyLabel: string
): GridRow[] {
    const result: GridRow[] = [];
    const seen = new Set<string>();
    rows.forEach(row => {
        if (row.totals || row.detail || row.group) {
            return;
        }
        const keys: string[] = [];
        groupBy.forEach((colId, level) => {
            const key = groupKey(row, colId);
            keys.push(key);
            const path = pathFor(keys);
            if (seen.has(path)) {
                return;
            }
            seen.add(path);
            result.push({
                id: groupRowId(path),
                cells: {},
                group: { level, colId, caption: captionOf(colId), label: key || emptyLabel, path, count: 0 }
            });
        });
    });
    return result;
}

/** Natural comparison of two cell values: numbers and dates numerically, text ignoring case. */
export function compareGroupValues(a: unknown, b: unknown): number {
    const empty = (value: unknown): boolean => value === undefined || value === null || value === "";
    if (empty(a) || empty(b)) {
        return empty(a) === empty(b) ? 0 : empty(a) ? -1 : 1;
    }
    if (typeof a === "number" && typeof b === "number") {
        return a - b;
    }
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() - b.getTime();
    }
    if (typeof a === "boolean" && typeof b === "boolean") {
        return a === b ? 0 : a ? 1 : -1;
    }
    return String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

export interface CollapseState {
    /** "expanded": groups are open unless listed; "collapsed": groups are closed unless listed. */
    mode: "expanded" | "collapsed";
    exceptions: ReadonlySet<string>;
}

export function isCollapsed(state: CollapseState, path: string): boolean {
    return state.mode === "collapsed" ? !state.exceptions.has(path) : state.exceptions.has(path);
}

export function toggleCollapsed(state: CollapseState, path: string): CollapseState {
    const exceptions = new Set(state.exceptions);
    if (exceptions.has(path)) {
        exceptions.delete(path);
    } else {
        exceptions.add(path);
    }
    return { mode: state.mode, exceptions };
}

export interface ArrangeOptions<T> {
    rowOf: (node: T) => GridRow | undefined;
    groupBy: string[];
    collapse: CollapseState;
    /** Sort direction of a grouped column when the user sorted by it; groups are ascending otherwise. */
    direction: (colId: string) => GroupDirection | undefined;
    columns: ColumnsType[];
}

export interface ArrangeResult<T> {
    /** Rows to display: group headers, the rows of expanded groups and their detail rows. */
    display: T[];
    /** Every leaf row (no group or detail rows) in grouped order, also those of collapsed groups. */
    leaves: GridRow[];
    /** Group headers and leaves in fully expanded order with their outline level (leaves: groupBy.length), for exports. */
    sequence: Array<{ row: GridRow; level: number }>;
}

/**
 * Puts the filtered and sorted rows into group order. Mutates the group rows' `group.count` and `cells`
 * (the aggregates), which the grid shows after a cell refresh.
 */
export function arrangeGroups<T>(nodes: T[], options: ArrangeOptions<T>): ArrangeResult<T> {
    const { rowOf, groupBy, collapse, direction, columns } = options;
    const groupNodes = new Map<string, T>();
    const detailNodes = new Map<string, T>();
    const leaves: T[] = [];
    nodes.forEach(node => {
        const row = rowOf(node);
        if (!row) {
            return;
        }
        if (row.group) {
            groupNodes.set(row.group.path, node);
        } else if (row.detail && row.parentId) {
            detailNodes.set(row.parentId, node);
        } else if (!row.totals) {
            leaves.push(node);
        }
    });

    const display: T[] = [];
    const orderedLeaves: GridRow[] = [];
    const sequence: Array<{ row: GridRow; level: number }> = [];

    const emitLeaf = (node: T, visible: boolean): void => {
        const row = rowOf(node) as GridRow;
        orderedLeaves.push(row);
        sequence.push({ row, level: groupBy.length });
        if (visible) {
            display.push(node);
            const detail = detailNodes.get(row.id);
            if (detail !== undefined) {
                display.push(detail);
            }
        }
    };

    const visit = (bucket: T[], level: number, keys: string[], visible: boolean): GridRow[] => {
        if (level >= groupBy.length) {
            bucket.forEach(node => emitLeaf(node, visible));
            return bucket.map(node => rowOf(node) as GridRow);
        }
        const colId = groupBy[level];
        const buckets = new Map<string, T[]>();
        bucket.forEach(node => {
            const key = groupKey(rowOf(node) as GridRow, colId);
            const list = buckets.get(key);
            if (list) {
                list.push(node);
            } else {
                buckets.set(key, [node]);
            }
        });
        const descending = direction(colId) === "desc";
        const ordered = Array.from(buckets.entries()).sort(([, a], [, b]) => {
            const result = compareGroupValues(
                (rowOf(a[0]) as GridRow).cells[colId]?.value,
                (rowOf(b[0]) as GridRow).cells[colId]?.value
            );
            return descending ? -result : result;
        });
        const collected: GridRow[] = [];
        ordered.forEach(([key, members]) => {
            const path = pathFor([...keys, key]);
            const header = groupNodes.get(path);
            const headerRow = header !== undefined ? rowOf(header) : undefined;
            const open = !isCollapsed(collapse, path);
            if (header !== undefined && visible) {
                display.push(header);
            }
            if (headerRow) {
                sequence.push({ row: headerRow, level });
            }
            const groupLeaves = visit(members, level + 1, [...keys, key], visible && open);
            if (headerRow?.group) {
                headerRow.group.count = groupLeaves.length;
                headerRow.cells = computeTotalsFromRows(groupLeaves, columns, "").cells;
            }
            collected.push(...groupLeaves);
        });
        return collected;
    };

    visit(leaves, 0, [], true);
    return { display, leaves: orderedLeaves, sequence };
}

/** "Department > City" style description of a grouping, for the On group by change action. */
export function describeGroupBy(groupBy: string[], captionOf: (colId: string) => string): string {
    return groupBy.map(captionOf).join(" > ");
}
