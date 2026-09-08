import {
    Problem,
    Properties,
    hideNestedPropertiesIn,
    hidePropertiesIn,
    hidePropertyIn
} from "@mendix/pluggable-widgets-tools";

import { ColumnsPreviewType, AGGridPreviewProps } from "../typings/AGGridProps";
import { headerGroups, previewColumnGrow } from "./utils/headerGroups";

type ColumnKey = keyof ColumnsPreviewType;

// ---- Structure mode preview (same building blocks and palette as Data Grid 2) ---------------------

interface ContainerProps {
    type: "Container";
    children?: StructurePreviewProps[];
    borders?: boolean;
    borderWidth?: number;
    borderRadius?: number;
    backgroundColor?: string;
    grow?: number;
    padding?: number;
}

interface RowLayoutProps {
    type: "RowLayout";
    children: StructurePreviewProps[];
    columnSize?: "fixed" | "grow";
    borders?: boolean;
    borderWidth?: number;
    backgroundColor?: string;
    grow?: number;
    padding?: number;
}

interface TextProps {
    type: "Text";
    content: string;
    fontSize?: number;
    fontColor?: string;
    bold?: boolean;
    italic?: boolean;
}

interface DropZoneProps {
    type: "DropZone";
    property: object;
    placeholder?: string;
    showDataSourceHeader?: boolean;
    grow?: number;
}

interface SelectableProps {
    type: "Selectable";
    object: object;
    child: StructurePreviewProps;
    grow?: number;
}

interface DatasourceProps {
    type: "Datasource";
    property: object | null;
    child?: StructurePreviewProps;
}

type StructurePreviewProps =
    | ContainerProps
    | RowLayoutProps
    | TextProps
    | DropZoneProps
    | SelectableProps
    | DatasourceProps;

const PALETTE = {
    light: {
        text: { primary: "#2F3646", secondary: "#6B707B", data: "#146FF4" },
        background: { topbarData: "#DCEEFE", topbarStandard: "#F7F7F7", container: "#FFFFFF", containerFill: "#F2F2F3" }
    },
    dark: {
        text: { primary: "#DEDEDE", secondary: "#A4A4A4", data: "#579BF9" },
        background: {
            topbarData: "#333A65E5",
            topbarStandard: "#33646464",
            container: "#313131",
            containerFill: "#3E3E3E"
        }
    }
};

const container =
    (props: Omit<ContainerProps, "type" | "children"> = {}) =>
    (...children: StructurePreviewProps[]): ContainerProps => ({ type: "Container", ...props, children });
const rowLayout =
    (props: Omit<RowLayoutProps, "type" | "children"> = {}) =>
    (...children: StructurePreviewProps[]): RowLayoutProps => ({ type: "RowLayout", ...props, children });
const text =
    (props: Omit<TextProps, "type" | "content"> = {}) =>
    (content: string): TextProps => ({ type: "Text", ...props, content });
const dropZone = (property: object, placeholder: string, hideHeader: boolean): DropZoneProps => ({
    type: "DropZone",
    property,
    placeholder,
    ...(hideHeader ? { showDataSourceHeader: false } : {})
});

function columnCaption(column: ColumnsPreviewType, index: number): string {
    if (column.header?.trim()) {
        return column.header;
    }
    if (column.columnType === "attribute" && column.attribute) {
        return column.attribute.split("/").pop() ?? column.attribute;
    }
    return column.columnType === "dynamicText" ? "Dynamic text" : `Column ${index + 1}`;
}

const columnGrow = previewColumnGrow;

export function getPreview(
    values: AGGridPreviewProps,
    isDarkMode: boolean,
    version: number[] = [0, 0, 0]
): StructurePreviewProps {
    const [major = 0, minor = 0] = version;
    const modernStudio = major > 9 || (major === 9 && minor >= 20);
    const palette = isDarkMode ? PALETTE.dark : PALETTE.light;
    const hasColumns = values.columns.length > 0;
    const columns = hasColumns ? values.columns : [];
    const cell = (
        props: Omit<ContainerProps, "type" | "children">
    ): ((...children: StructurePreviewProps[]) => ContainerProps) => container({ borders: true, ...props });

    const titleBar = rowLayout({
        columnSize: "fixed",
        backgroundColor: palette.background.topbarData,
        borders: true,
        borderWidth: 1
    })(container({ padding: 4 })(text({ fontColor: palette.text.data })("AGGrid")));

    const toolbarButtons: string[] = [];
    if (values.showColumnChooser) {
        toolbarButtons.push(values.labelColumns || "Columns");
    }
    if (values.showRefreshButton) {
        toolbarButtons.push(values.labelRefresh || "Refresh");
    }
    if (values.showResetButton) {
        toolbarButtons.push(values.labelReset || "Reset");
    }
    if (values.showExportButton && values.exportFormat !== "csv") {
        toolbarButtons.push(values.labelExportExcel || "Export Excel");
    }
    if (values.showExportButton && values.exportFormat !== "excel") {
        toolbarButtons.push(values.labelExportCsv || "Export CSV");
    }
    const toolbar =
        values.showQuickFilter || toolbarButtons.length > 0
            ? [
                  rowLayout({ columnSize: "fixed", borders: true, padding: 6 })(
                      container({ grow: 3 })(
                          text({ fontSize: 10, fontColor: palette.text.secondary })(
                              values.showQuickFilter ? `🔍 ${values.quickFilterPlaceholder || "Search..."}` : ""
                          )
                      ),
                      container({ grow: 1 })(
                          text({ fontSize: 10, fontColor: palette.text.data })(toolbarButtons.join("   "))
                      )
                  )
              ]
            : [];

    const extraHeaders: StructurePreviewProps[] = [];
    const extraCells: StructurePreviewProps[] = [];
    if (values.selection !== "None" && values.checkboxSelection) {
        extraHeaders.push(
            cell({ grow: 0, backgroundColor: palette.background.topbarStandard, padding: 8 })(
                text({ fontSize: 10 })("☐")
            )
        );
        extraCells.push(cell({ grow: 0, padding: 8 })(text({ fontSize: 10, fontColor: palette.text.secondary })("☐")));
    }
    if (values.showRowNumbers) {
        extraHeaders.push(
            cell({ grow: 0, backgroundColor: palette.background.topbarStandard, padding: 8 })(
                text({ fontSize: 10, bold: true })("#")
            )
        );
        extraCells.push(cell({ grow: 0, padding: 8 })(text({ fontSize: 10, fontColor: palette.text.secondary })("1")));
    }

    // Header groups: adjacent columns with the same caption share one spanning cell, like at runtime.
    const groups = headerGroups(columns);
    const groupRow =
        hasColumns && groups.some(group => group.caption)
            ? [
                  rowLayout({ columnSize: "fixed" })(
                      ...extraCells.map(() =>
                          cell({ grow: 0, padding: 8, backgroundColor: palette.background.topbarStandard })(
                              text({ fontSize: 10 })(" ")
                          )
                      ),
                      ...groups.map(group =>
                          cell({ grow: group.grow, padding: 8, backgroundColor: palette.background.topbarStandard })(
                              text({ bold: true, fontSize: 10, fontColor: palette.text.primary })(group.caption || " ")
                          )
                      )
                  )
              ]
            : [];

    const headerRow = rowLayout({ columnSize: "fixed" })(
        ...extraHeaders,
        ...(hasColumns
            ? columns.map((column, index): StructurePreviewProps => {
                  const hidden = column.visible.trim() === "false";
                  const header = cell({
                      grow: columnGrow(column),
                      backgroundColor: hidden ? palette.background.containerFill : palette.background.topbarStandard
                  })(
                      rowLayout({ columnSize: "grow" })(
                          container({ grow: 0, backgroundColor: "#AEEdAA" })(container({ padding: hidden ? 3 : 0 })()),
                          container({ padding: 8 })(
                              container({ grow: 1, padding: 8 })(
                                  text({ bold: true, fontSize: 10, fontColor: palette.text.primary })(
                                      `${columnCaption(column, index)}${
                                          column.sortable && column.columnType !== "customContent" ? " ⇅" : ""
                                      }`
                                  )
                              )
                          )
                      )
                  );
                  return { type: "Selectable", object: column, child: header, grow: columnGrow(column) };
              })
            : [
                  cell({ grow: 1, backgroundColor: palette.background.topbarStandard, padding: 8 })(
                      text({ bold: true, fontSize: 10, fontColor: palette.text.secondary })("Add columns")
                  )
              ])
    );

    const filterRow =
        values.floatingFilters && hasColumns
            ? [
                  rowLayout({ columnSize: "fixed" })(
                      ...extraCells.map(() => cell({ grow: 0, padding: 8 })(text({ fontSize: 10 })(" "))),
                      ...columns.map(column =>
                          cell({ grow: columnGrow(column), padding: 6 })(
                              text({ fontSize: 10, fontColor: palette.text.secondary })(
                                  column.columnType !== "customContent" && column.filterType !== "none"
                                      ? "[ filter ]"
                                      : ""
                              )
                          )
                      )
                  )
              ]
            : [];

    const dataRow = rowLayout({ columnSize: "fixed" })(
        ...extraCells,
        ...(hasColumns
            ? columns.map(column => {
                  const hidden = column.visible.trim() === "false";
                  if (column.columnType === "customContent") {
                      return cell({ grow: columnGrow(column) })(
                          dropZone(column.content, "Custom content", modernStudio)
                      );
                  }
                  const content =
                      column.columnType === "dynamicText"
                          ? column.dynamicText || "Dynamic text"
                          : `[${column.attribute || "No attribute selected"}]`;
                  return cell({
                      grow: columnGrow(column),
                      padding: 8,
                      backgroundColor: hidden ? palette.background.containerFill : undefined
                  })(text({ fontSize: 10, fontColor: palette.text.secondary })(content));
              })
            : [cell({ grow: 1, padding: 8 })(text({ fontSize: 10, fontColor: palette.text.secondary })("…"))])
    );

    const totalsRow =
        values.totalsRow !== "none" && hasColumns
            ? [
                  rowLayout({ columnSize: "fixed", backgroundColor: palette.background.containerFill })(
                      ...extraCells.map(() => cell({ grow: 0, padding: 8 })(text({ fontSize: 10 })(" "))),
                      ...columns.map((column, index) =>
                          cell({ grow: columnGrow(column), padding: 8 })(
                              text({ fontSize: 10, bold: true, fontColor: palette.text.primary })(
                                  totalsCaption(values, column, index)
                              )
                          )
                      )
                  )
              ]
            : [];

    const emptyRow =
        values.emptyPlaceholder.widgetCount > 0
            ? [
                  rowLayout({ columnSize: "fixed", borders: true })(
                      dropZone(values.emptyPlaceholder, "Empty placeholder", modernStudio)
                  )
              ]
            : [];

    const pager = values.pagination
        ? [
              rowLayout({ columnSize: "fixed", borders: true, padding: 6 })(
                  container({ grow: 1 })(text({ fontSize: 10 })("")),
                  container({ grow: 0 })(
                      text({ fontSize: 10, fontColor: palette.text.secondary })(`«  ‹   ${pagingStatus(values)}   ›  »`)
                  )
              )
          ]
        : [];

    const datasourceHeader: StructurePreviewProps[] = modernStudio
        ? [{ type: "Datasource", property: values.datasource }]
        : [];

    return container()(
        titleBar,
        ...datasourceHeader,
        ...toolbar,
        ...groupRow,
        headerRow,
        ...filterRow,
        ...Array.from({ length: values.totalsRow !== "none" ? 4 : 5 }).map(() => dataRow),
        ...totalsRow,
        ...emptyRow,
        ...pager
    );
}

/** Text shown in the totals row of a column in the previews. */
export function totalsCaption(values: AGGridPreviewProps, column: ColumnsPreviewType, index: number): string {
    const fromDatasource = values.totalsSource === "datasource";
    const hasTotal = fromDatasource ? Boolean(column.totalAttribute) : column.aggregate !== "none";
    if (hasTotal) {
        return fromDatasource ? `[${column.totalAttribute}]` : `[${column.aggregate}]`;
    }
    return index === 0 ? values.totalsLabel || "Total" : "";
}

/** Paging status text of the previews, using the configurable template. */
export function pagingStatus(values: AGGridPreviewProps): string {
    const size = String(values.pageSize ?? 20);
    return (values.labelPagingStatus || "[first] to [last] of [total]")
        .replace("[first]", "1")
        .replace("[last]", size)
        .replace("[total]", size);
}

export function getCustomCaption(values: AGGridPreviewProps): string {
    const datasource = values.datasource as { caption?: string } | null;
    return datasource?.caption || "AGGrid";
}

export function getProperties(values: AGGridPreviewProps, defaultProperties: Properties): Properties {
    const serverMode = values.dataMode === "server";

    values.columns.forEach((column, index) => {
        const hidden: ColumnKey[] = [];
        if (column.columnType !== "attribute") {
            hidden.push(
                "attribute",
                "attributeName",
                "editable",
                "onChange",
                "aggregate",
                "decimalPrecision",
                "groupDigits"
            );
        } else if (!column.editable) {
            hidden.push("attributeName");
        }
        if (column.columnType === "customContent") {
            hidden.push("renderAs");
        }
        if (values.totalsRow === "none" || values.totalsSource !== "datasource") {
            hidden.push("totalAttribute");
        }
        if (values.totalsRow !== "none" && values.totalsSource === "datasource") {
            hidden.push("aggregate");
        }
        if (column.columnType !== "dynamicText") {
            hidden.push("dynamicText");
        }
        if (column.columnType !== "customContent") {
            hidden.push("content");
        } else {
            hidden.push("sortable", "filterType", "wrapText");
        }
        if (column.widthMode !== "fixed") {
            hidden.push("width");
        }
        if (column.widthMode !== "flex") {
            hidden.push("flex");
        }
        hideNestedPropertiesIn(defaultProperties, values, "columns", index, hidden);
    });

    if (serverMode) {
        hidePropertiesIn(defaultProperties, values, [
            "rowLimit",
            "rowDrag",
            "rowDragAttribute",
            "onRowDragEnd",
            "autoPageSize"
        ]);
    }
    if (values.selection === "None") {
        hidePropertiesIn(defaultProperties, values, [
            "checkboxSelection",
            "headerCheckbox",
            "clickSelection",
            "showSelectionCount"
        ]);
    } else if (values.selection === "Single" || !values.checkboxSelection || serverMode) {
        hidePropertyIn(defaultProperties, values, "headerCheckbox");
    }

    if (!values.showQuickFilter) {
        hidePropertiesIn(defaultProperties, values, ["quickFilterPlaceholder"]);
    }
    if (!values.showExportButton) {
        hidePropertiesIn(defaultProperties, values, ["exportFormat", "exportFileName"]);
    }
    if (!values.pagination) {
        hidePropertiesIn(defaultProperties, values, ["pageSize", "pageSizeSelector", "autoPageSize"]);
    } else if (values.layout !== "fixedHeight") {
        hidePropertyIn(defaultProperties, values, "autoPageSize");
    }
    if (!values.rowDrag) {
        hidePropertiesIn(defaultProperties, values, ["rowDragAttribute", "onRowDragEnd"]);
    }
    if (values.layout !== "fixedHeight") {
        hidePropertyIn(defaultProperties, values, "height");
    }
    if (values.totalsRow === "none") {
        hidePropertiesIn(defaultProperties, values, ["totalsLabel", "totalsSource", "totalsDatasource"]);
    } else if (values.totalsSource !== "datasource") {
        hidePropertyIn(defaultProperties, values, "totalsDatasource");
    }
    if (values.commitMode !== "action") {
        hidePropertyIn(defaultProperties, values, "onCommit");
    }
    if (values.stateStorage !== "attribute") {
        hidePropertyIn(defaultProperties, values, "columnStateAttribute");
    }
    if (!values.showColumnChooser) {
        hidePropertyIn(defaultProperties, values, "labelColumns");
    }
    if (!values.showRefreshButton) {
        hidePropertyIn(defaultProperties, values, "labelRefresh");
    }
    if (!values.showResetButton) {
        hidePropertyIn(defaultProperties, values, "labelReset");
    }
    if (!values.showExportButton || values.exportFormat === "csv") {
        hidePropertyIn(defaultProperties, values, "labelExportExcel");
    }
    if (!values.showExportButton || values.exportFormat === "excel") {
        hidePropertyIn(defaultProperties, values, "labelExportCsv");
    }
    if (values.selection === "None" || !values.showSelectionCount) {
        hidePropertiesIn(defaultProperties, values, ["labelSelected", "labelClearSelection"]);
    }
    if (!values.pagination || values.theme !== "atlas") {
        hidePropertiesIn(defaultProperties, values, ["labelPageSize", "labelPagingStatus"]);
    } else if (!values.pageSizeSelector) {
        hidePropertyIn(defaultProperties, values, "labelPageSize");
    }

    return defaultProperties;
}

export function check(values: AGGridPreviewProps): Problem[] {
    const problems: Problem[] = [];
    const serverMode = values.dataMode === "server";

    if (values.columns.length === 0) {
        problems.push({
            property: "columns",
            severity: "warning",
            message: "Add at least one column, otherwise the grid shows no data."
        });
    }

    values.columns.forEach((column, index) => {
        const prefix = `columns/${index + 1}/`;
        if (column.columnType === "attribute" && !column.attribute) {
            problems.push({
                property: `${prefix}attribute`,
                severity: "error",
                message: `Column ${index + 1}: select an attribute or change 'Show'.`
            });
        }
        if (column.columnType === "dynamicText" && !column.dynamicText) {
            problems.push({
                property: `${prefix}dynamicText`,
                severity: "error",
                message: `Column ${index + 1}: enter the dynamic text expression.`
            });
        }
        if (column.columnType === "customContent" && column.content.widgetCount === 0) {
            problems.push({
                property: `${prefix}content`,
                severity: "warning",
                message: `Column ${index + 1}: the custom content is empty.`
            });
        }
        if (column.widthMode === "fixed" && (column.width ?? 0) <= 0) {
            problems.push({
                property: `${prefix}width`,
                severity: "error",
                message: `Column ${index + 1}: the fixed width must be greater than 0.`
            });
        }
        if (column.widthMode === "flex" && (column.flex ?? 0) <= 0) {
            problems.push({
                property: `${prefix}flex`,
                severity: "error",
                message: `Column ${index + 1}: flex must be greater than 0.`
            });
        }
        if (
            column.minWidth != null &&
            column.maxWidth != null &&
            column.minWidth > 0 &&
            column.maxWidth > 0 &&
            column.minWidth > column.maxWidth
        ) {
            problems.push({
                property: `${prefix}maxWidth`,
                severity: "error",
                message: `Column ${index + 1}: max width is smaller than min width.`
            });
        }
        if (
            values.totalsRow !== "none" &&
            values.totalsSource === "datasource" &&
            column.totalAttribute &&
            !values.totalsDatasource
        ) {
            problems.push({
                property: `${prefix}totalAttribute`,
                severity: "error",
                message: `Column ${index + 1}: select a totals data source (Appearance > Totals row) first.`
            });
        }
        if (column.aggregate !== "none" && values.totalsRow === "none") {
            problems.push({
                property: `${prefix}aggregate`,
                severity: "warning",
                message: `Column ${
                    index + 1
                } has a totals row value, but the totals row is off (Appearance > Totals row).`
            });
        }
        if (serverMode && column.columnType === "dynamicText" && column.sortable) {
            problems.push({
                property: `${prefix}sortable`,
                severity: "warning",
                message: `Column ${
                    index + 1
                }: dynamic text columns cannot be sorted or filtered when data is loaded from the server.`
            });
        }
    });

    if (values.commitMode === "action" && !values.onCommit) {
        problems.push({
            property: "onCommit",
            severity: "error",
            message: "Select an On commit action, or change Commit to another mode."
        });
    }
    if (values.stateStorage === "attribute" && !values.columnStateAttribute) {
        problems.push({
            property: "columnStateAttribute",
            severity: "error",
            message: "Select a layout attribute, or change 'Remember layout in' to another option."
        });
    }
    if (values.totalsRow !== "none" && values.totalsSource === "datasource" && !values.totalsDatasource) {
        problems.push({
            property: "totalsDatasource",
            severity: "error",
            message: "Select a totals data source, or change 'Totals from' to 'Loaded rows'."
        });
    }
    if (values.pagination && (values.pageSize ?? 0) <= 0) {
        problems.push({ property: "pageSize", severity: "error", message: "Page size must be greater than 0." });
    }
    if (values.pagination && values.pageSizeSelector.trim()) {
        const invalid = values.pageSizeSelector.split(",").some(part => !/^\s*\d+\s*$/.test(part));
        if (invalid) {
            problems.push({
                property: "pageSizeSelector",
                severity: "error",
                message: "Page size choices must be a comma-separated list of numbers, e.g. 10,20,50."
            });
        }
    }
    if (values.layout === "fixedHeight" && !values.height.trim()) {
        problems.push({
            property: "height",
            severity: "error",
            message: "Enter a grid height (for example 500px) or choose another height mode."
        });
    }
    if ((values.rowLimit ?? 0) < 0) {
        problems.push({ property: "rowLimit", severity: "error", message: "Max rows to load cannot be negative." });
    }
    if ((values.refreshInterval ?? 0) < 0) {
        problems.push({ property: "refreshInterval", severity: "error", message: "Refresh time cannot be negative." });
    }
    if (
        values.rowDrag &&
        !serverMode &&
        values.columns.some(column => column.sortable && column.columnType !== "customContent")
    ) {
        problems.push({
            property: "rowDrag",
            severity: "warning",
            message: "Row drag works best when no column is sortable; sorting overrides the dragged order."
        });
    }
    if (serverMode && values.totalsRow !== "none") {
        problems.push({
            property: "totalsRow",
            severity: "warning",
            message: "With server data loading the totals row only covers the rows that are loaded in the browser."
        });
    }
    if (
        values.accentColor.trim() &&
        !/^(#[0-9a-f]{3,8}|[a-z]+|rgba?\(.*\)|hsla?\(.*\))$/i.test(values.accentColor.trim())
    ) {
        problems.push({
            property: "accentColor",
            severity: "warning",
            message: "Accent color does not look like a CSS color (e.g. #264AE5 or rgb(38, 74, 229))."
        });
    }

    return problems;
}
