import { Big } from "big.js";
import { ListAttributeValue, ObjectItem } from "mendix";

import { ColumnsType } from "../../typings/AGGridProps";

export type AttributeValue = string | Big | boolean | Date;
export type ListAttribute = ListAttributeValue<AttributeValue>;

/** The kind of value a column holds, used to pick AG Grid data types, filters and editors. */
export type CellKind = "text" | "number" | "boolean" | "date" | "enum" | "object";

export interface CellData {
    /** Raw value as AG Grid sees it: string, number, boolean, Date or undefined. */
    value: unknown;
    /** Formatted value produced by Mendix, used for display and text filtering. */
    display: string;
    validation?: string;
    readOnly: boolean;
}

export interface GridRow {
    id: string;
    item?: ObjectItem;
    cells: Record<string, CellData>;
    /** Set on the totals row so renderers can tell it apart from data rows. */
    totals?: boolean;
}

export const TOTALS_ROW_ID = "__mxt_totals__";

export function columnId(index: number): string {
    return `col${index}`;
}

export function cellKind(column: ColumnsType): CellKind {
    if (column.columnType === "dynamicText") {
        return "text";
    }
    if (column.columnType === "customContent" || !column.attribute) {
        return "object";
    }
    switch (column.attribute.type) {
        case "Integer":
        case "Long":
        case "Decimal":
        case "AutoNumber":
            return "number";
        case "Boolean":
            return "boolean";
        case "DateTime":
            return "date";
        case "Enum":
            return "enum";
        default:
            return "text";
    }
}

/** Converts a Mendix attribute value to the primitive AG Grid should sort, filter and edit. */
export function toGridValue(value: AttributeValue | undefined): unknown {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (value instanceof Big) {
        return value.toNumber();
    }
    return value;
}

/** Converts a value coming out of an AG Grid editor back to what the Mendix attribute expects. */
export function toMendixValue(kind: CellKind, value: unknown): AttributeValue | undefined {
    if (value === undefined || value === null || value === "") {
        return kind === "text" ? "" : undefined;
    }
    switch (kind) {
        case "number": {
            const numeric = typeof value === "number" ? value : Number(value);
            return Number.isFinite(numeric) ? new Big(numeric) : undefined;
        }
        case "boolean":
            return value === true || value === "true";
        case "date":
            return value instanceof Date ? value : new Date(String(value));
        default:
            return String(value);
    }
}

export interface NumberFormat {
    /** Fixed number of decimals, or a negative value to keep the Mendix default formatting. */
    precision: number;
    groupDigits: boolean;
}

function currentLocale(): string | undefined {
    const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
    return lang || (typeof navigator !== "undefined" ? navigator.language : undefined);
}

/** Formats a grid value with the Mendix formatter of the attribute, so numbers, dates and enums look as configured. */
export function formatValue(
    attribute: ListAttribute | undefined,
    kind: CellKind,
    value: unknown,
    numberFormat?: NumberFormat
): string {
    if (value === undefined || value === null || value === "") {
        return "";
    }
    if (kind === "number" && numberFormat && (numberFormat.precision >= 0 || numberFormat.groupDigits)) {
        const numeric = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(numeric)) {
            const digits = numberFormat.precision >= 0 ? numberFormat.precision : undefined;
            return new Intl.NumberFormat(currentLocale(), {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits ?? 10,
                useGrouping: numberFormat.groupDigits
            }).format(numeric);
        }
    }
    if (!attribute) {
        return String(value);
    }
    try {
        return attribute.formatter.format(toMendixValue(kind, value) as AttributeValue);
    } catch {
        return String(value);
    }
}

interface MxClientObject {
    get: (attribute: string) => unknown;
    set: (attribute: string, value: unknown) => void;
    getAttributes: () => string[];
    getAttributeType: (attribute: string) => string;
}

interface MxClientData {
    get: (options: {
        guid?: string;
        guids?: string[];
        callback: (result: MxClientObject | MxClientObject[]) => void;
        error?: (error: unknown) => void;
    }) => void;
    commit?: (options: { mxobj: MxClientObject; callback: () => void; error?: (error: unknown) => void }) => void;
}

function reportError(message: string, error: unknown): void {
    console.error(`AGGrid: ${message}`, error);
    const mx = (window as unknown as { mx?: { ui?: { error?: (text: string) => void } } }).mx;
    mx?.ui?.error?.(`${message}: ${error instanceof Error ? error.message : String(error)}`);
}

function clientData(): MxClientData | undefined {
    const mx = (window as unknown as { mx?: { data?: MxClientData } }).mx;
    return mx?.data && typeof mx.data.get === "function" ? mx.data : undefined;
}

function getObjects(data: MxClientData, guids: string[]): Promise<MxClientObject[]> {
    return new Promise((resolve, reject) => {
        data.get({
            guids,
            callback: result => resolve(Array.isArray(result) ? result : [result]),
            error: reject
        });
    });
}

/** Converts a Mendix value to what the client object API expects for the attribute type. */
function toClientValue(kind: CellKind, value: AttributeValue | undefined): unknown {
    if (value === undefined) {
        return kind === "text" ? "" : null;
    }
    if (value instanceof Big) {
        return value.toString();
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    return value;
}

/** Compares a raw client object value with a pluggable widget attribute value. */
function sameValue(kind: CellKind, raw: unknown, value: AttributeValue | undefined): boolean {
    const rawEmpty = raw === undefined || raw === null || raw === "";
    const valueEmpty = value === undefined || value === null || value === "";
    if (rawEmpty || valueEmpty) {
        return rawEmpty && valueEmpty;
    }
    switch (kind) {
        case "number":
            return Number(String(raw)) === Number(String(value));
        case "date":
            return Number(raw) === (value instanceof Date ? value.getTime() : Number(value));
        case "boolean":
            return raw === value;
        default:
            return String(raw) === String(value);
    }
}

const CLIENT_TYPES: Record<CellKind, string[]> = {
    text: ["String", "HashString"],
    number: ["Integer", "Long", "Decimal", "AutoNumber"],
    boolean: ["Boolean"],
    date: ["DateTime"],
    enum: ["Enum"],
    object: []
};

const attributeNames = new Map<string, Promise<string | undefined>>();

/**
 * The pluggable widget API hides the attribute name behind an opaque id, so the name is recovered by
 * matching the values of the loaded objects against the attribute values of the same items.
 */
function resolveAttributeName(
    data: MxClientData,
    attribute: ListAttribute,
    kind: CellKind,
    items: ObjectItem[]
): Promise<string | undefined> {
    const cached = attributeNames.get(attribute.id);
    if (cached) {
        return cached;
    }
    const sample = items.slice(0, 8);
    const resolved = getObjects(
        data,
        sample.map(item => item.id)
    )
        .then(objects => {
            let candidates: string[] | undefined;
            objects.forEach((object, index) => {
                const expected = attribute.get(sample[index]).value;
                const matching = (candidates ?? object.getAttributes()).filter(
                    name =>
                        CLIENT_TYPES[kind].includes(object.getAttributeType(name)) &&
                        sameValue(kind, object.get(name), expected)
                );
                candidates = matching;
            });
            if (!candidates || candidates.length !== 1) {
                console.warn("AGGrid: cannot tell which attribute to write, candidates:", candidates);
                attributeNames.delete(attribute.id);
                return undefined;
            }
            return candidates[0];
        })
        .catch(error => {
            console.error("AGGrid: could not load objects to write an attribute", error);
            attributeNames.delete(attribute.id);
            return undefined;
        });
    attributeNames.set(attribute.id, resolved);
    return resolved;
}

/**
 * Writes a new value to an attribute of a data source item. The pluggable widget API cannot write
 * attributes linked to a data source yet ("setValue is not yet supported"), so when the value is
 * read-only the Mendix client API is used; the data source then pushes the change back into the grid.
 * Returns false when there is no way to write the value.
 */
export interface WriteOptions {
    /** Commit the object through the client API right after the write. */
    commit?: boolean;
    /** Attribute name configured by the developer; skips the value-matching inference. */
    attributeName?: string;
    /** Called once the value has been written (and committed when requested). */
    onWritten?: (attributeName: string) => void;
}

export function writeValue(
    attribute: ListAttribute,
    item: ObjectItem,
    kind: CellKind,
    value: AttributeValue | undefined,
    items: ObjectItem[],
    options: WriteOptions = {}
): boolean {
    const editable = attribute.get(item);
    const data = clientData();
    const override = options.attributeName?.trim();
    if (!editable.readOnly) {
        editable.setValue(value);
        if (options.commit && data) {
            commitItem(data, item, () => options.onWritten?.(override ?? ""));
        } else {
            options.onWritten?.(override ?? "");
        }
        return true;
    }
    if (!data) {
        return false;
    }
    const resolved = override
        ? Promise.resolve(override)
        : resolveAttributeName(data, attribute, kind, items.length > 0 ? items : [item]);
    resolved
        .then(name => {
            if (!name) {
                return;
            }
            return getObjects(data, [item.id]).then(([object]) => {
                if (!object) {
                    return;
                }
                object.set(name, toClientValue(kind, value));
                if (options.commit) {
                    commitObject(data, object, () => options.onWritten?.(name));
                } else {
                    options.onWritten?.(name);
                }
            });
        })
        .catch(error => reportError("could not write the value", error));
    return true;
}

function commitObject(data: MxClientData, object: MxClientObject, done?: () => void): void {
    if (!data.commit) {
        done?.();
        return;
    }
    data.commit({
        mxobj: object,
        callback: () => done?.(),
        error: error => reportError("could not save the object", error)
    });
}

function commitItem(data: MxClientData, item: ObjectItem, done?: () => void): void {
    getObjects(data, [item.id])
        .then(([object]) => (object ? commitObject(data, object, done) : done?.()))
        .catch(error => reportError("could not save the object", error));
}

export function buildRow(item: ObjectItem, columns: ColumnsType[]): GridRow {
    const cells: Record<string, CellData> = {};
    columns.forEach((column, index) => {
        const id = columnId(index);
        if (column.columnType === "attribute" && column.attribute) {
            const editable = column.attribute.get(item);
            cells[id] = {
                value: toGridValue(editable.value),
                display: editable.displayValue,
                validation: editable.validation,
                readOnly: editable.readOnly
            };
        } else if (column.columnType === "dynamicText") {
            const text = column.dynamicText?.get(item).value ?? "";
            cells[id] = { value: text, display: text, readOnly: true };
        } else {
            cells[id] = { value: undefined, display: "", readOnly: true };
        }
    });
    return { id: item.id, item, cells };
}

export function buildRows(items: ObjectItem[] | undefined, columns: ColumnsType[]): GridRow[] {
    return (items ?? []).map(item => buildRow(item, columns));
}

/** Enumeration key to caption map, used by the select editor and for sorting enum columns by caption. */
export function enumCaptions(attribute: ListAttribute): Record<string, string> {
    const captions: Record<string, string> = {};
    (attribute.universe ?? []).forEach(key => {
        const text = String(key);
        captions[text] = formatValue(attribute, "enum", text) || text;
    });
    return captions;
}
