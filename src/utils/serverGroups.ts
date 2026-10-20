import type { ColumnsType } from "../../typings/AGGridProps";
import { GridRow, cellKind, enumCaptions, formatValue } from "./rows";

/**
 * Lazy server-side groups: with Server data loading the grid can group by an enumeration or boolean column. The
 * group values are known up front (enumeration keys, true/false), so the grid asks the data source for the size of
 * every group and loads the rows of a group, page by page, when it is expanded.
 */

export const LOAD_MORE_PREFIX = "__mxt_more__:";
export const SERVER_GROUP_PREFIX = "__mxt_sgroup__:";

export interface ServerGroupValue {
    /** Caption shown in the group row ("" for empty). */
    label: string;
    /** Attribute value to filter on; undefined means "empty". */
    value: string | boolean | undefined;
}

export interface ServerGroup extends ServerGroupValue {
    path: string;
    count?: number;
    rows: GridRow[];
    open: boolean;
    loading: boolean;
    error?: string;
}

/** Whether a column can be grouped lazily on the server. */
export function canServerGroup(column: ColumnsType | undefined): boolean {
    if (!column || column.columnType !== "attribute" || !column.attribute || column.groupable === false) {
        return false;
    }
    const kind = cellKind(column);
    return (kind === "enum" || kind === "boolean") && column.attribute.filterable;
}

/** The group values of a column: every enumeration key plus "empty", or Yes / No. */
export function serverGroupValues(column: ColumnsType): ServerGroupValue[] {
    const attribute = column.attribute;
    if (!attribute) {
        return [];
    }
    if (cellKind(column) === "boolean") {
        return [
            { label: formatValue(attribute, "boolean", true), value: true },
            { label: formatValue(attribute, "boolean", false), value: false }
        ];
    }
    const captions = enumCaptions(attribute);
    return [
        ...Object.entries(captions).map(([key, caption]) => ({ label: caption, value: key })),
        { label: "", value: undefined }
    ];
}

export function serverGroupPath(label: string): string {
    return JSON.stringify([label]);
}

export function initialServerGroups(values: ServerGroupValue[]): ServerGroup[] {
    return values.map(value => ({
        ...value,
        path: serverGroupPath(value.label),
        rows: [],
        open: false,
        loading: false
    }));
}

/**
 * Rows to show: a header per group with rows (groups that turned out empty are hidden), the loaded rows of open
 * groups and a "load more" row when a group has more rows than loaded.
 */
export function serverGroupDisplay(
    groups: ServerGroup[],
    colId: string,
    caption: string,
    emptyLabel: string
): GridRow[] {
    const result: GridRow[] = [];
    groups.forEach(group => {
        if (group.count === 0) {
            return;
        }
        result.push({
            id: SERVER_GROUP_PREFIX + group.path,
            cells: {},
            group: {
                level: 0,
                colId,
                caption,
                label: group.label || emptyLabel,
                path: group.path,
                count: group.count ?? 0
            }
        });
        if (!group.open) {
            return;
        }
        group.rows.forEach(row => result.push(row));
        const total = group.count ?? group.rows.length;
        if (group.rows.length < total || group.loading || group.error) {
            result.push({
                id: LOAD_MORE_PREFIX + group.path,
                cells: {},
                loadMore: { groupPath: group.path, loaded: group.rows.length, total }
            });
        }
    });
    return result;
}

export function updateGroup(groups: ServerGroup[], path: string, change: Partial<ServerGroup>): ServerGroup[] {
    return groups.map(group => (group.path === path ? { ...group, ...change } : group));
}
