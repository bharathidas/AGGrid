import type { ColumnsType } from "../../typings/AGGridProps";
import type { CellData, GridRow } from "./rows";
import { computeTotalsFromRows } from "./totals";

/**
 * Tree data for the browser row model, built on AG Grid Community (tree data is an AG Grid Enterprise feature).
 * Every row gets its place in the hierarchy from a key and a parent key, or from a path ("Europe/Norway/Oslo",
 * missing levels become generated "filler" rows). After AG Grid filtered and sorted the rows, `arrangeTree` puts
 * every row under its parent, keeps the ancestors of matching rows (as context), hides the children of closed
 * rows and computes the descendant counts and, optionally, the aggregates per parent.
 */

export const TREE_COLUMN_ID = "__mxt_tree__";
const FILLER_PREFIX = "__mxt_tree__:";
const PATH_JOIN = "\u0001";

export type TreeMode = "parentKey" | "path";

export interface TreeInfo {
    /** 0 is the top level. */
    level: number;
    /** Unique key of the tree node. */
    key: string;
    label: string;
    hasChildren: boolean;
    /** Generated path level without an object of its own. */
    filler?: boolean;
    /** Number of data rows below this row (after filtering). */
    descendants: number;
    /** Shown only because a descendant matches the filters. */
    context?: boolean;
}

export interface TreeRowInput {
    key?: string;
    parentKey?: string;
    /** Path parts from the top level down to the row itself. */
    path?: string[];
    label?: string;
}

export interface TreeModel {
    /** Data rows (with tree info) followed by the generated filler rows. */
    rows: GridRow[];
    /** Parent row id of every row (undefined for top-level rows). */
    parentOf: Map<string, string | undefined>;
    /** Child row ids per parent row id ("" holds the top-level rows), in data order. */
    childrenOf: Map<string, string[]>;
    byId: Map<string, GridRow>;
}

export function splitPath(path: string | undefined, separator: string): string[] {
    if (!path) {
        return [];
    }
    const sep = separator || "/";
    return path
        .split(sep)
        .map(part => part.trim())
        .filter(part => part !== "");
}

export function fillerRowId(key: string): string {
    return FILLER_PREFIX + key;
}

/** Builds the hierarchy. Rows keep their order; cycles and unknown parents make a row a top-level row. */
export function buildTree(rows: GridRow[], inputOf: (row: GridRow) => TreeRowInput, mode: TreeMode): TreeModel {
    const parentOf = new Map<string, string | undefined>();
    const childrenOf = new Map<string, string[]>();
    const byId = new Map<string, GridRow>();
    const result: GridRow[] = [];
    const info = new Map<string, TreeInfo>();
    const addChild = (parent: string | undefined, child: string): void => {
        const list = childrenOf.get(parent ?? "");
        if (list) {
            list.push(child);
        } else {
            childrenOf.set(parent ?? "", [child]);
        }
    };

    if (mode === "parentKey") {
        const keyToId = new Map<string, string>();
        const inputs = rows.map(row => ({ row, input: inputOf(row) }));
        inputs.forEach(({ row, input }) => {
            const key = (input.key ?? "").trim() || row.id;
            if (!keyToId.has(key)) {
                keyToId.set(key, row.id);
            }
            info.set(row.id, {
                level: 0,
                key,
                label: (input.label ?? "").trim() || (input.key ?? "").trim(),
                hasChildren: false,
                descendants: 0
            });
        });
        inputs.forEach(({ row, input }) => {
            const parentKey = (input.parentKey ?? "").trim();
            const parentId = parentKey ? keyToId.get(parentKey) : undefined;
            parentOf.set(row.id, parentId && parentId !== row.id ? parentId : undefined);
        });
        // Break cycles: a row whose ancestor chain returns to itself becomes a top-level row.
        rows.forEach(row => {
            const seen = new Set<string>([row.id]);
            let current = parentOf.get(row.id);
            while (current !== undefined) {
                if (seen.has(current)) {
                    parentOf.set(row.id, undefined);
                    break;
                }
                seen.add(current);
                current = parentOf.get(current);
            }
        });
        rows.forEach(row => {
            const tree = info.get(row.id) as TreeInfo;
            const next: GridRow = { ...row, tree };
            byId.set(row.id, next);
            result.push(next);
            addChild(parentOf.get(row.id), row.id);
        });
    } else {
        const keyToId = new Map<string, string>();
        const fillers: GridRow[] = [];
        const ensureFiller = (parts: string[]): string => {
            const key = parts.join(PATH_JOIN);
            const existing = keyToId.get(key);
            if (existing) {
                return existing;
            }
            const id = fillerRowId(key);
            keyToId.set(key, id);
            const parentId = parts.length > 1 ? ensureFiller(parts.slice(0, -1)) : undefined;
            const filler: GridRow = {
                id,
                cells: {},
                tree: {
                    level: parts.length - 1,
                    key,
                    label: parts[parts.length - 1],
                    hasChildren: true,
                    filler: true,
                    descendants: 0
                }
            };
            parentOf.set(id, parentId);
            byId.set(id, filler);
            fillers.push(filler);
            addChild(parentId, id);
            return id;
        };
        // First pass: the data rows own their path (so a later row is not turned into a filler).
        const owned = rows.map(row => {
            const input = inputOf(row);
            const parts = input.path ?? [];
            let key = parts.join(PATH_JOIN);
            if (!parts.length || keyToId.has(key)) {
                // No path, or the same path twice: keep the row, unique by its id.
                key = `${key}${PATH_JOIN}#${row.id}`;
            }
            keyToId.set(key, row.id);
            return { row, input, parts, key };
        });
        owned.forEach(({ row, input, parts, key }) => {
            const parentId = parts.length > 1 ? ensureFiller(parts.slice(0, -1)) : undefined;
            const realParent = parentId && parentId !== row.id ? parentId : undefined;
            parentOf.set(row.id, realParent);
            const next: GridRow = {
                ...row,
                tree: {
                    level: 0,
                    key,
                    label: (input.label ?? "").trim() || parts[parts.length - 1] || "",
                    hasChildren: false,
                    descendants: 0
                }
            };
            byId.set(row.id, next);
            result.push(next);
            addChild(realParent, row.id);
        });
        // A filler created before the data row with the same path was registered is replaced by that row.
        result.push(...fillers.filter(filler => keyToId.get(filler.tree?.key ?? "") === filler.id));
    }

    // Levels and the has-children flag.
    const levelOf = (id: string): number => {
        let level = 0;
        let current = parentOf.get(id);
        while (current !== undefined && level < 1000) {
            level++;
            current = parentOf.get(current);
        }
        return level;
    };
    result.forEach(row => {
        if (row.tree) {
            row.tree.level = levelOf(row.id);
            row.tree.hasChildren = (childrenOf.get(row.id)?.length ?? 0) > 0;
        }
    });
    return { rows: result, parentOf, childrenOf, byId };
}

/** Which rows are open: rows above the configured depth are open unless toggled, the others closed unless toggled. */
export interface TreeExpandState {
    /** Levels open by default: 0 = only the top level shown, -1 = everything open. */
    depth: number;
    toggled: ReadonlySet<string>;
}

export function isTreeOpen(state: TreeExpandState, key: string, level: number): boolean {
    const openByDefault = state.depth < 0 || level < state.depth;
    return state.toggled.has(key) ? !openByDefault : openByDefault;
}

export function toggleTreeKey(state: TreeExpandState, key: string): TreeExpandState {
    const toggled = new Set(state.toggled);
    if (toggled.has(key)) {
        toggled.delete(key);
    } else {
        toggled.add(key);
    }
    return { depth: state.depth, toggled };
}

export interface ArrangeTreeOptions<T> {
    rowOf: (node: T) => GridRow | undefined;
    /** Node of a row that AG Grid filtered out (needed to show ancestors of matching rows). */
    nodeOf: (id: string) => T | undefined;
    model: TreeModel;
    expand: TreeExpandState;
    /** Columns, to compute the aggregates per parent. */
    columns?: ColumnsType[];
    /** Data parents show the aggregates of their descendants (filler rows always do). */
    aggregateParents?: boolean;
}

export interface ArrangeTreeResult<T> {
    display: T[];
    /** Every included row in fully expanded order with its level, for exports. */
    sequence: Array<{ row: GridRow; level: number }>;
    /** Ids of rows shown only for context (an ancestor of a matching row that does not match itself). */
    contextIds: Set<string>;
}

/**
 * Puts the filtered and sorted nodes into tree order. Siblings keep AG Grid's sort order; an ancestor that did
 * not pass the filters is placed where its first matching descendant was.
 */
export function arrangeTree<T>(nodes: T[], options: ArrangeTreeOptions<T>): ArrangeTreeResult<T> {
    const { rowOf, nodeOf, model, expand } = options;
    const position = new Map<string, number>();
    const nodeById = new Map<string, T>();
    nodes.forEach((node, index) => {
        const row = rowOf(node);
        if (row?.tree) {
            position.set(row.id, index);
            nodeById.set(row.id, node);
        }
    });
    const passing = new Set(position.keys());
    // Ancestors of matching rows are included and ordered by their first matching descendant.
    const included = new Set<string>(passing);
    passing.forEach(id => {
        const own = position.get(id) as number;
        let parent = model.parentOf.get(id);
        while (parent !== undefined) {
            included.add(parent);
            const current = position.get(parent);
            // Generated levels and filtered-out ancestors take the place of their first descendant.
            const flexible = !passing.has(parent) || Boolean(model.byId.get(parent)?.tree?.filler);
            if (current === undefined || (flexible && own < current)) {
                position.set(parent, current === undefined ? own : Math.min(current, own));
            }
            parent = model.parentOf.get(parent);
        }
    });
    const contextIds = new Set<string>();
    included.forEach(id => {
        const row = model.byId.get(id);
        if (!passing.has(id) && row && !row.tree?.filler) {
            contextIds.add(id);
        }
    });

    const display: T[] = [];
    const sequence: Array<{ row: GridRow; level: number }> = [];
    const childrenSorted = (parentId: string): string[] =>
        (model.childrenOf.get(parentId) ?? [])
            .filter(id => included.has(id))
            .sort((a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0));

    // Returns the matching data rows below (and including) the row, for counts and aggregates.
    const visit = (id: string, visible: boolean): GridRow[] => {
        const row = model.byId.get(id);
        if (!row?.tree) {
            return [];
        }
        const node = nodeById.get(id) ?? nodeOf(id);
        row.tree.context = contextIds.has(id);
        if (visible && node !== undefined) {
            display.push(node);
        }
        sequence.push({ row, level: row.tree.level });
        const open = isTreeOpen(expand, row.tree.key, row.tree.level);
        const below: GridRow[] = [];
        childrenSorted(id).forEach(child => {
            for (const entry of visit(child, visible && open)) {
                below.push(entry);
            }
        });
        row.tree.descendants = below.length;
        row.tree.hasChildren = (model.childrenOf.get(id)?.length ?? 0) > 0;
        if (row.tree.hasChildren && options.columns && (row.tree.filler || options.aggregateParents)) {
            row.aggCells = computeTotalsFromRows(below, options.columns, "").cells;
        } else {
            row.aggCells = undefined;
        }
        if (row.item && passing.has(id)) {
            below.unshift(row);
        }
        return below;
    };
    childrenSorted("").forEach(id => visit(id, true));
    return { display, sequence, contextIds };
}

/** Every key in the model, for "expand all". */
export function allTreeKeys(model: TreeModel): string[] {
    return model.rows.filter(row => row.tree?.hasChildren).map(row => row.tree?.key as string);
}

/** The cell a tree row shows for a column: the aggregate of its descendants when it has one. */
export function treeDisplayCell(row: GridRow | undefined, colId: string): CellData | undefined {
    if (!row) {
        return undefined;
    }
    const aggregate = row.aggCells?.[colId];
    if (aggregate && aggregate.display) {
        return aggregate;
    }
    return row.cells[colId];
}
