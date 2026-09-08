import { ColumnsPreviewType } from "../../typings/AGGridProps";

export interface HeaderGroup {
    caption: string;
    /** Number of columns spanned. */
    span: number;
    /** Sum of the column grow factors, for proportional widths. */
    grow: number;
}

export function previewColumnGrow(column: ColumnsPreviewType): number {
    return column.widthMode === "flex" && column.flex ? column.flex : 1;
}

/** Groups adjacent columns that share a header group caption; ungrouped columns get an empty caption. */
export function headerGroups(columns: ColumnsPreviewType[]): HeaderGroup[] {
    const groups: HeaderGroup[] = [];
    columns.forEach(column => {
        const caption = column.headerGroup?.trim() ?? "";
        const previous = groups[groups.length - 1];
        if (caption && previous && previous.caption === caption) {
            previous.span += 1;
            previous.grow += previewColumnGrow(column);
        } else {
            groups.push({ caption, span: 1, grow: previewColumnGrow(column) });
        }
    });
    return groups;
}
