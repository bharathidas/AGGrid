/**
 * Texts of the 1.3 user interface (set filter, side panel, pivot, chart, totals menu). Wherever AG Grid's locale
 * pack has the same term (it ships the Enterprise vocabulary too) the grid uses it, so these texts follow the
 * Mendix session language for every language the widget maps (see locale.ts); the remaining few are English
 * defaults. The most visible ones are widget properties (Labels) and so translatable in Studio Pro.
 */

export interface UiTexts {
    selectAll: string;
    blanks: string;
    search: string;
    searchValues: string;
    noMatches: string;
    columns: string;
    filters: string;
    pivotMode: string;
    rowGroups: string;
    rowGroupsEmpty: string;
    values: string;
    valuesEmpty: string;
    columnLabels: string;
    columnLabelsEmpty: string;
    sum: string;
    avg: string;
    min: string;
    max: string;
    count: string;
    distinctCount: string;
    none: string;
    expandAll: string;
    collapseAll: string;
    bar: string;
    line: string;
    pie: string;
    clear: string;
    close: string;
    moveUp: string;
    moveDown: string;
    remove: string;
    hidden: string;
    visible: string;
    loadMore: string;
    loading: string;
    saving: string;
    other: string;
    dataTable: string;
    sheetData: string;
    sheetPivot: string;
    sheetSelection: string;
    addTo: string;
    showAll: string;
    rangeCount: string;
    rangeSum: string;
    rangeAvg: string;
    tooManyValues: string;
    tooManyPivotColumns: string;
    noChartData: string;
    filterActive: string;
}

const ENGLISH: UiTexts = {
    selectAll: "(Select All)",
    blanks: "(Blanks)",
    search: "Search...",
    searchValues: "Search filter values",
    noMatches: "No matches",
    columns: "Columns",
    filters: "Filters",
    pivotMode: "Pivot Mode",
    rowGroups: "Row Groups",
    rowGroupsEmpty: "Drag here to set row groups",
    values: "Values",
    valuesEmpty: "Drag here to aggregate",
    columnLabels: "Column Labels",
    columnLabelsEmpty: "Drag here to set column labels",
    sum: "Sum",
    avg: "Average",
    min: "Min",
    max: "Max",
    count: "Count",
    distinctCount: "Distinct count",
    none: "None",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    bar: "Bar",
    line: "Line",
    pie: "Pie",
    clear: "Clear",
    close: "Close",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    hidden: "hidden",
    visible: "visible",
    loadMore: "Load more",
    loading: "Loading...",
    saving: "Saving...",
    other: "Other",
    dataTable: "Data table",
    sheetData: "Data",
    sheetPivot: "Pivot",
    sheetSelection: "Selection",
    addTo: "Add to",
    showAll: "Show all",
    rangeCount: "Count",
    rangeSum: "Sum",
    rangeAvg: "Average",
    tooManyValues: "Showing the first [count] values; type to search.",
    tooManyPivotColumns: "Too many column labels; only the first [count] pivot columns are shown.",
    noChartData: "The selected range has no numbers to chart.",
    filterActive: "filtered"
};

/** Which AG Grid locale key provides each text. */
const FROM_AG_GRID: Partial<Record<keyof UiTexts, string>> = {
    selectAll: "selectAll",
    blanks: "blanks",
    search: "searchOoo",
    searchValues: "ariaSearchFilterValues",
    noMatches: "noMatches",
    columns: "columns",
    filters: "filters",
    pivotMode: "pivotMode",
    rowGroups: "groups",
    rowGroupsEmpty: "rowGroupColumnsEmptyMessage",
    values: "values",
    valuesEmpty: "valueColumnsEmptyMessage",
    columnLabels: "pivots",
    columnLabelsEmpty: "pivotColumnsEmptyMessage",
    sum: "sum",
    avg: "avg",
    min: "min",
    max: "max",
    count: "count",
    bar: "barChart",
    line: "lineChart",
    pie: "pieChart",
    clear: "clearFilter",
    hidden: "ariaHidden",
    visible: "ariaVisible",
    loading: "loadingOoo",
    rangeCount: "count",
    rangeSum: "sum",
    rangeAvg: "avg"
};

export function uiTexts(localeText: Record<string, string> | undefined): UiTexts {
    if (!localeText) {
        return ENGLISH;
    }
    const texts: UiTexts = { ...ENGLISH };
    (Object.keys(FROM_AG_GRID) as Array<keyof UiTexts>).forEach(key => {
        const source = FROM_AG_GRID[key] as string;
        const value = localeText[source];
        if (typeof value === "string" && value.trim()) {
            texts[key] = value;
        }
    });
    return texts;
}

export function aggregateLabel(texts: UiTexts, fn: string): string {
    switch (fn) {
        case "sum":
            return texts.sum;
        case "avg":
            return texts.avg;
        case "min":
            return texts.min;
        case "max":
            return texts.max;
        case "count":
            return texts.count;
        case "distinctCount":
            return texts.distinctCount;
        default:
            return texts.none;
    }
}
