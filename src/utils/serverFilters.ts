import { Big } from "big.js";
import { SortModelItem } from "ag-grid-community";
import { FilterCondition } from "mendix/filters";
import {
    and,
    attribute,
    contains,
    dayEquals,
    dayGreaterThan,
    dayGreaterThanOrEqual,
    dayLessThan,
    dayLessThanOrEqual,
    dayNotEqual,
    empty,
    endsWith,
    equals,
    greaterThan,
    greaterThanOrEqual,
    lessThan,
    lessThanOrEqual,
    literal,
    not,
    notEqual,
    or,
    startsWith
} from "mendix/filters/builders";

/** `or`/`and` need at least two arguments; a single condition is returned as is. */
function anyOf(conditions: FilterCondition[]): FilterCondition {
    return conditions.length === 1 ? conditions[0] : or(...conditions);
}

function allOf(conditions: FilterCondition[]): FilterCondition {
    return conditions.length === 1 ? conditions[0] : and(...conditions);
}
import { ListAttributeValue } from "mendix";

import { ColumnsType } from "../../typings/AGGridProps";
import { AttributeValue, CellKind, cellKind, enumCaptions, formatValue } from "./rows";

type SortDirection = "asc" | "desc";
type AttributeId = ListAttributeValue<AttributeValue>["id"];
export type SortOrder = Array<[AttributeId, SortDirection]>;

interface SimpleFilterModel {
    filterType?: string;
    type?: string;
    filter?: unknown;
    filterTo?: unknown;
    dateFrom?: string;
    dateTo?: string;
    operator?: "AND" | "OR";
    conditions?: SimpleFilterModel[];
    condition1?: SimpleFilterModel;
    condition2?: SimpleFilterModel;
}

export type FilterModel = Record<string, SimpleFilterModel>;

function columnByColId(columns: ColumnsType[], colId: string): ColumnsType | undefined {
    const match = /^col(\d+)$/.exec(colId);
    return match ? columns[Number(match[1])] : undefined;
}

/** Turns the AG Grid sort model into a Mendix sort order; only attribute columns can sort on the server. */
export function buildSortOrder(sortModel: SortModelItem[], columns: ColumnsType[]): SortOrder {
    const order: SortOrder = [];
    sortModel.forEach(item => {
        const column = columnByColId(columns, item.colId);
        if (column?.columnType === "attribute" && column.attribute?.sortable) {
            order.push([column.attribute.id, item.sort]);
        }
    });
    return order;
}

/** Caption to value map for enumeration and boolean attributes, so caption filters can be sent to the server. */
function captionValues(attr: ListAttributeValue<AttributeValue>, kind: CellKind): Array<[string, AttributeValue]> {
    if (kind === "enum") {
        return Object.entries(enumCaptions(attr)).map(([key, caption]) => [caption, key]);
    }
    if (kind === "boolean") {
        return [
            [formatValue(attr, "boolean", true), true],
            [formatValue(attr, "boolean", false), false]
        ];
    }
    return [];
}

function parseDate(text: string | undefined): Date | undefined {
    if (!text) {
        return undefined;
    }
    const date = new Date(text.replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseNumber(value: unknown): Big | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? new Big(numeric) : undefined;
}

/** A condition that never matches, used when a caption filter has no matching enumeration value. */
function nothing(attr: ListAttributeValue<AttributeValue>): FilterCondition {
    return and(equals(attribute(attr.id), empty()), notEqual(attribute(attr.id), empty()));
}

function textCondition(
    attr: ListAttributeValue<AttributeValue>,
    kind: CellKind,
    model: SimpleFilterModel
): FilterCondition | undefined {
    const field = attribute(attr.id);
    const text = model.filter === undefined || model.filter === null ? "" : String(model.filter);
    if (model.type === "blank") {
        return equals(field, empty());
    }
    if (model.type === "notBlank") {
        return notEqual(field, empty());
    }
    if (kind === "enum" || kind === "boolean") {
        // Captions are matched in the browser and translated to the underlying values.
        const needle = text.toLowerCase();
        const matches = captionValues(attr, kind).filter(([caption]) => {
            const haystack = caption.toLowerCase();
            switch (model.type) {
                case "equals":
                    return haystack === needle;
                case "notEqual":
                case "notContains":
                    return !haystack.includes(needle);
                case "startsWith":
                    return haystack.startsWith(needle);
                case "endsWith":
                    return haystack.endsWith(needle);
                default:
                    return haystack.includes(needle);
            }
        });
        if (matches.length === 0) {
            return nothing(attr);
        }
        return anyOf(matches.map(([, value]) => equals(field, literal(value))));
    }
    switch (model.type) {
        case "equals":
            return equals(field, literal(text));
        case "notEqual":
            return notEqual(field, literal(text));
        case "startsWith":
            return startsWith(field, literal(text));
        case "endsWith":
            return endsWith(field, literal(text));
        case "notContains":
            return and(notEqual(field, empty()), not(contains(field, literal(text))));
        default:
            return contains(field, literal(text));
    }
}

function numberCondition(
    attr: ListAttributeValue<AttributeValue>,
    model: SimpleFilterModel
): FilterCondition | undefined {
    const field = attribute(attr.id);
    const value = parseNumber(model.filter);
    const to = parseNumber(model.filterTo);
    switch (model.type) {
        case "blank":
            return equals(field, empty());
        case "notBlank":
            return notEqual(field, empty());
        case "equals":
            return value ? equals(field, literal(value)) : undefined;
        case "notEqual":
            return value ? notEqual(field, literal(value)) : undefined;
        case "greaterThan":
            return value ? greaterThan(field, literal(value)) : undefined;
        case "greaterThanOrEqual":
            return value ? greaterThanOrEqual(field, literal(value)) : undefined;
        case "lessThan":
            return value ? lessThan(field, literal(value)) : undefined;
        case "lessThanOrEqual":
            return value ? lessThanOrEqual(field, literal(value)) : undefined;
        case "inRange":
            return value && to
                ? and(greaterThanOrEqual(field, literal(value)), lessThanOrEqual(field, literal(to)))
                : undefined;
        default:
            return undefined;
    }
}

function dateCondition(
    attr: ListAttributeValue<AttributeValue>,
    model: SimpleFilterModel
): FilterCondition | undefined {
    const field = attribute(attr.id);
    const from = parseDate(model.dateFrom);
    const to = parseDate(model.dateTo);
    switch (model.type) {
        case "blank":
            return equals(field, empty());
        case "notBlank":
            return notEqual(field, empty());
        case "equals":
            return from ? dayEquals(field, literal(from)) : undefined;
        case "notEqual":
            return from ? dayNotEqual(field, literal(from)) : undefined;
        case "greaterThan":
            return from ? dayGreaterThan(field, literal(from)) : undefined;
        case "greaterThanOrEqual":
            return from ? dayGreaterThanOrEqual(field, literal(from)) : undefined;
        case "lessThan":
            return from ? dayLessThan(field, literal(from)) : undefined;
        case "lessThanOrEqual":
            return from ? dayLessThanOrEqual(field, literal(from)) : undefined;
        case "inRange":
            return from && to
                ? and(dayGreaterThanOrEqual(field, literal(from)), dayLessThanOrEqual(field, literal(to)))
                : undefined;
        default:
            return undefined;
    }
}

function columnCondition(column: ColumnsType, model: SimpleFilterModel): FilterCondition | undefined {
    const attr = column.attribute;
    if (!attr || column.columnType !== "attribute" || !attr.filterable) {
        return undefined;
    }
    const conditions =
        model.conditions ?? [model.condition1, model.condition2].filter((c): c is SimpleFilterModel => !!c);
    if (conditions.length > 0 && model.operator) {
        const parts = conditions
            .map(condition => columnCondition(column, condition))
            .filter((c): c is FilterCondition => !!c);
        if (parts.length === 0) {
            return undefined;
        }
        return model.operator === "OR" ? anyOf(parts) : allOf(parts);
    }
    const kind = cellKind(column);
    switch (model.filterType ?? kind) {
        case "number":
            return kind === "number" ? numberCondition(attr, model) : undefined;
        case "date":
            return kind === "date" ? dateCondition(attr, model) : undefined;
        default:
            return textCondition(attr, kind, model);
    }
}

/** Translates the AG Grid filter model plus the quick search text into one Mendix filter condition. */
export function buildFilter(
    filterModel: FilterModel | undefined,
    quickFilter: string,
    columns: ColumnsType[]
): FilterCondition | undefined {
    const parts: FilterCondition[] = [];
    Object.entries(filterModel ?? {}).forEach(([colId, model]) => {
        const column = columnByColId(columns, colId);
        const condition = column ? columnCondition(column, model) : undefined;
        if (condition) {
            parts.push(condition);
        }
    });

    const text = quickFilter.trim();
    if (text) {
        const searches: FilterCondition[] = [];
        columns.forEach(column => {
            const attr = column.attribute;
            if (!attr || column.columnType !== "attribute" || !attr.filterable) {
                return;
            }
            const kind = cellKind(column);
            if (kind === "text") {
                searches.push(contains(attribute(attr.id), literal(text)));
            } else if (kind === "enum" || kind === "boolean") {
                captionValues(attr, kind)
                    .filter(([caption]) => caption.toLowerCase().includes(text.toLowerCase()))
                    .forEach(([, value]) => searches.push(equals(attribute(attr.id), literal(value))));
            } else if (kind === "number") {
                const numeric = parseNumber(text);
                if (numeric) {
                    searches.push(equals(attribute(attr.id), literal(numeric)));
                }
            }
        });
        if (searches.length > 0) {
            parts.push(anyOf(searches));
        } else if (columns.some(column => column.columnType === "attribute")) {
            // Nothing can match the search text.
            const first = columns.find(column => column.columnType === "attribute" && column.attribute)?.attribute;
            if (first) {
                parts.push(nothing(first));
            }
        }
    }

    return parts.length === 0 ? undefined : allOf(parts);
}
