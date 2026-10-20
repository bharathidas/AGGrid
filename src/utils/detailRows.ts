import type { GridRow } from "./rows";

export const DETAIL_COLUMN_ID = "__mxt_detail__";
const DETAIL_SUFFIX = "__mxt_detail";

export type DetailExpandMode = "single" | "multiple";

export function detailRowId(parentId: string): string {
    return parentId + DETAIL_SUFFIX;
}

/**
 * Inserts a full-width detail row right after every expanded row. The detail row shares the cells of its
 * parent, so column filters and the quick search keep or drop it together with the parent.
 */
export function withDetailRows(rows: GridRow[], expanded: ReadonlySet<string>): GridRow[] {
    if (expanded.size === 0) {
        return rows;
    }
    const result: GridRow[] = [];
    rows.forEach(row => {
        result.push(row);
        if (!row.totals && !row.detail && expanded.has(row.id)) {
            result.push({ id: detailRowId(row.id), item: row.item, cells: row.cells, detail: true, parentId: row.id });
        }
    });
    return result;
}

/**
 * Moves every detail row directly under its parent after sorting (AG Grid sorts detail rows like any
 * other row). Detail rows whose parent is not in the list keep their relative order at the end.
 */
export function placeDetailRows<T>(nodes: T[], rowOf: (node: T) => GridRow | undefined): void {
    const details = new Map<string, T>();
    const others: T[] = [];
    nodes.forEach(node => {
        const row = rowOf(node);
        if (row?.detail && row.parentId) {
            details.set(row.parentId, node);
        } else {
            others.push(node);
        }
    });
    if (details.size === 0) {
        return;
    }
    const ordered: T[] = [];
    others.forEach(node => {
        ordered.push(node);
        const id = rowOf(node)?.id;
        const detail = id !== undefined ? details.get(id) : undefined;
        if (detail !== undefined) {
            ordered.push(detail);
            details.delete(id as string);
        }
    });
    details.forEach(node => ordered.push(node));
    if (ordered.some((node, index) => node !== nodes[index])) {
        nodes.splice(0, nodes.length, ...ordered);
    }
}

/** Expanded row ids after the user toggled one row. */
export function toggleExpanded(expanded: ReadonlySet<string>, id: string, mode: DetailExpandMode): Set<string> {
    if (expanded.has(id)) {
        const next = new Set(expanded);
        next.delete(id);
        return next;
    }
    if (mode === "single") {
        return new Set([id]);
    }
    const next = new Set(expanded);
    next.add(id);
    return next;
}

/** Rows expanded before the user touched anything. */
export function initialExpanded(rowIds: string[], mode: DetailExpandMode, startCollapsed: boolean): Set<string> {
    if (startCollapsed || rowIds.length === 0) {
        return new Set();
    }
    return mode === "single" ? new Set([rowIds[0]]) : new Set(rowIds);
}

/** 1-based row numbers in display order that skip detail, totals and group rows. */
export function numberRows<T>(nodes: T[], rowOf: (node: T) => GridRow | undefined): Map<string, number> {
    const numbers = new Map<string, number>();
    nodes.forEach(node => {
        const row = rowOf(node);
        if (row && !row.detail && !row.totals && !row.group) {
            numbers.set(row.id, numbers.size + 1);
        }
    });
    return numbers;
}
