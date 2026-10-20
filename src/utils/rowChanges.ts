import type { GridRow } from "./rows";

/** Above this many changed rows a refresh is treated as a reload and nothing is highlighted. */
export const MAX_HIGHLIGHTED_ROWS = 50;

/** What a row shows, used to tell whether a data refresh changed it. */
export function rowSignature(row: GridRow): string {
    return Object.keys(row.cells)
        .sort()
        .map(key => {
            const cell = row.cells[key];
            return `${key}=${cell.display}|${cell.error ?? ""}|${cell.validation ?? ""}`;
        })
        .join("␟");
}

export function snapshotRows(rows: GridRow[]): Map<string, string> {
    const snapshot = new Map<string, string>();
    rows.forEach(row => {
        if (!row.totals && !row.detail) {
            snapshot.set(row.id, rowSignature(row));
        }
    });
    return snapshot;
}

export interface RowDiff {
    /** Rows that existed before and show different values now. */
    changed: string[];
    /** Rows that were not there before. */
    added: string[];
    snapshot: Map<string, string>;
}

/**
 * Compares the rows with the snapshot of the previous data. Without a previous snapshot (the first
 * load) nothing counts as changed.
 */
export function diffRows(previous: Map<string, string> | undefined, rows: GridRow[]): RowDiff {
    const snapshot = snapshotRows(rows);
    const changed: string[] = [];
    const added: string[] = [];
    if (previous) {
        snapshot.forEach((signature, id) => {
            const before = previous.get(id);
            if (before === undefined) {
                added.push(id);
            } else if (before !== signature) {
                changed.push(id);
            }
        });
    }
    return { changed, added, snapshot };
}

/** Rows to highlight after a refresh: changed and added rows, minus the user's own edits, capped. */
export function rowsToHighlight(diff: RowDiff, skip: ReadonlySet<string>): string[] {
    const ids = [...diff.changed, ...diff.added].filter(id => !skip.has(id));
    return ids.length > MAX_HIGHLIGHTED_ROWS ? [] : ids;
}
