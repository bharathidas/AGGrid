/**
 * This file was generated from AGGrid.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import {
    ActionValue,
    DynamicValue,
    EditableValue,
    ListActionValue,
    ListAttributeValue,
    ListExpressionValue,
    ListValue,
    ListWidgetValue,
    Option,
    SelectionMultiValue,
    SelectionSingleValue
} from "mendix";
import { ComponentType, CSSProperties, ReactNode } from "react";
import { Big } from "big.js";

export type DataModeEnum = "client" | "server";

export type ColumnTypeEnum = "attribute" | "dynamicText" | "customContent";

export type RenderAsEnum = "text" | "link" | "badge" | "progress" | "image";

export type WidthModeEnum = "flex" | "fixed" | "auto";

export type FilterTypeEnum = "auto" | "text" | "number" | "date" | "none";

export type PinnedEnum = "none" | "left" | "right";

export type AggregateEnum = "none" | "sum" | "avg" | "min" | "max" | "count";

export type AlignmentEnum = "auto" | "left" | "center" | "right";

export interface ColumnsType {
    columnType: ColumnTypeEnum;
    attribute?: ListAttributeValue<string | Big | boolean | Date>;
    dynamicText?: ListExpressionValue<string>;
    content?: ListWidgetValue;
    header?: DynamicValue<string>;
    headerGroup: string;
    tooltip?: ListExpressionValue<string>;
    renderAs: RenderAsEnum;
    attributeName: string;
    totalAttribute?: ListAttributeValue<string | Big | boolean | Date>;
    widthMode: WidthModeEnum;
    flex: number;
    width: number;
    minWidth: number;
    maxWidth: number;
    sortable: boolean;
    filterType: FilterTypeEnum;
    editable?: ListExpressionValue<boolean>;
    pinned: PinnedEnum;
    visible?: DynamicValue<boolean>;
    resizable: boolean;
    movable: boolean;
    aggregate: AggregateEnum;
    alignment: AlignmentEnum;
    decimalPrecision: number;
    groupDigits: boolean;
    wrapText: boolean;
    autoHeight: boolean;
    cellClass?: ListExpressionValue<string>;
    onClick?: ListActionValue;
    onChange?: ListActionValue<{ newValue: Option<string>; oldValue: Option<string> }>;
}

export type ExportFormatEnum = "excel" | "csv" | "both";

export type EditTypeEnum = "cell" | "fullRow";

export type CommitModeEnum = "none" | "client" | "action";

export type AutoSizeStrategyEnum = "none" | "fitGridWidth" | "fitCellContents";

export type StateStorageEnum = "none" | "browser" | "attribute";

export type ThemeEnum = "atlas" | "quartz" | "alpine" | "balham" | "material";

export type ColorSchemeEnum = "light" | "dark" | "auto";

export type LayoutEnum = "fixedHeight" | "autoHeight" | "print";

export type TotalsRowEnum = "none" | "bottom" | "top";

export type TotalsSourceEnum = "loaded" | "datasource";

export interface ColumnsPreviewType {
    columnType: ColumnTypeEnum;
    attribute: string;
    dynamicText: string;
    content: { widgetCount: number; renderer: ComponentType<{ children: ReactNode; caption?: string }> };
    header: string;
    headerGroup: string;
    tooltip: string;
    renderAs: RenderAsEnum;
    attributeName: string;
    totalAttribute: string;
    widthMode: WidthModeEnum;
    flex: number | null;
    width: number | null;
    minWidth: number | null;
    maxWidth: number | null;
    sortable: boolean;
    filterType: FilterTypeEnum;
    editable: string;
    pinned: PinnedEnum;
    visible: string;
    resizable: boolean;
    movable: boolean;
    aggregate: AggregateEnum;
    alignment: AlignmentEnum;
    decimalPrecision: number | null;
    groupDigits: boolean;
    wrapText: boolean;
    autoHeight: boolean;
    cellClass: string;
    onClick: {} | null;
    onChange: {} | null;
}

export interface AGGridContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    datasource: ListValue;
    dataMode: DataModeEnum;
    rowLimit: number;
    refreshInterval: number;
    columns: ColumnsType[];
    selection?: SelectionSingleValue | SelectionMultiValue;
    checkboxSelection: boolean;
    headerCheckbox: boolean;
    clickSelection: boolean;
    showQuickFilter: boolean;
    quickFilterPlaceholder?: DynamicValue<string>;
    quickFilterAttribute?: EditableValue<string>;
    showExportButton: boolean;
    exportFormat: ExportFormatEnum;
    exportFileName: string;
    showResetButton: boolean;
    showRefreshButton: boolean;
    showColumnChooser: boolean;
    showSelectionCount: boolean;
    alwaysMultiSort: boolean;
    floatingFilters: boolean;
    pagination: boolean;
    pageSize: number;
    pageSizeSelector: string;
    autoPageSize: boolean;
    editType: EditTypeEnum;
    singleClickEdit: boolean;
    commitMode: CommitModeEnum;
    onCommit?: ListActionValue<{ newValue: Option<string>; oldValue: Option<string>; attributeName: Option<string> }>;
    undoRedo: boolean;
    enterNavigatesVertically: boolean;
    flashOnChange: boolean;
    autoSizeStrategy: AutoSizeStrategyEnum;
    stateStorage: StateStorageEnum;
    columnStateAttribute?: EditableValue<string>;
    rowDrag: boolean;
    rowDragAttribute?: ListAttributeValue<Big>;
    theme: ThemeEnum;
    colorScheme: ColorSchemeEnum;
    accentColor: string;
    fontSize: number;
    spacing: number;
    layout: LayoutEnum;
    height: string;
    rowHeight: number;
    headerHeight: number;
    wrapHeaderText: boolean;
    showRowNumbers: boolean;
    animateRows: boolean;
    rowHoverHighlight: boolean;
    columnHoverHighlight: boolean;
    cellTextSelection: boolean;
    rowClass?: ListExpressionValue<string>;
    totalsRow: TotalsRowEnum;
    totalsLabel?: DynamicValue<string>;
    totalsSource: TotalsSourceEnum;
    totalsDatasource?: ListValue;
    labelColumns?: DynamicValue<string>;
    labelRefresh?: DynamicValue<string>;
    labelReset?: DynamicValue<string>;
    labelExportExcel?: DynamicValue<string>;
    labelExportCsv?: DynamicValue<string>;
    labelSelected?: DynamicValue<string>;
    labelClearSelection?: DynamicValue<string>;
    labelPageSize?: DynamicValue<string>;
    labelPagingStatus?: DynamicValue<string>;
    noRowsText?: DynamicValue<string>;
    emptyPlaceholder?: ReactNode;
    onRowClick?: ListActionValue;
    onRowDoubleClick?: ListActionValue;
    onCellValueChange?: ListActionValue<{ newValue: Option<string>; oldValue: Option<string> }>;
    onRowDragEnd?: ActionValue;
}

export interface AGGridPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    datasource: {} | { caption: string } | { type: string } | null;
    dataMode: DataModeEnum;
    rowLimit: number | null;
    refreshInterval: number | null;
    columns: ColumnsPreviewType[];
    selection: "None" | "Single" | "Multi";
    checkboxSelection: boolean;
    headerCheckbox: boolean;
    clickSelection: boolean;
    showQuickFilter: boolean;
    quickFilterPlaceholder: string;
    quickFilterAttribute: string;
    showExportButton: boolean;
    exportFormat: ExportFormatEnum;
    exportFileName: string;
    showResetButton: boolean;
    showRefreshButton: boolean;
    showColumnChooser: boolean;
    showSelectionCount: boolean;
    alwaysMultiSort: boolean;
    floatingFilters: boolean;
    pagination: boolean;
    pageSize: number | null;
    pageSizeSelector: string;
    autoPageSize: boolean;
    editType: EditTypeEnum;
    singleClickEdit: boolean;
    commitMode: CommitModeEnum;
    onCommit: {} | null;
    undoRedo: boolean;
    enterNavigatesVertically: boolean;
    flashOnChange: boolean;
    autoSizeStrategy: AutoSizeStrategyEnum;
    stateStorage: StateStorageEnum;
    columnStateAttribute: string;
    rowDrag: boolean;
    rowDragAttribute: string;
    theme: ThemeEnum;
    colorScheme: ColorSchemeEnum;
    accentColor: string;
    fontSize: number | null;
    spacing: number | null;
    layout: LayoutEnum;
    height: string;
    rowHeight: number | null;
    headerHeight: number | null;
    wrapHeaderText: boolean;
    showRowNumbers: boolean;
    animateRows: boolean;
    rowHoverHighlight: boolean;
    columnHoverHighlight: boolean;
    cellTextSelection: boolean;
    rowClass: string;
    totalsRow: TotalsRowEnum;
    totalsLabel: string;
    totalsSource: TotalsSourceEnum;
    totalsDatasource: {} | { caption: string } | { type: string } | null;
    labelColumns: string;
    labelRefresh: string;
    labelReset: string;
    labelExportExcel: string;
    labelExportCsv: string;
    labelSelected: string;
    labelClearSelection: string;
    labelPageSize: string;
    labelPagingStatus: string;
    noRowsText: string;
    emptyPlaceholder: { widgetCount: number; renderer: ComponentType<{ children: ReactNode; caption?: string }> };
    onRowClick: {} | null;
    onRowDoubleClick: {} | null;
    onSelectionChange: {} | null;
    onCellValueChange: {} | null;
    onRowDragEnd: {} | null;
}
