/* Minimal fakes for the Mendix column props used by the pure utilities. */
import { Big } from "big.js";
import { ListAttributeValue, ObjectItem } from "mendix";

import { ColumnsType } from "../../typings/AGGridProps";

type AttributeType = ListAttributeValue["type"];

export interface FakeAttributeOptions {
    id: string;
    type: AttributeType;
    universe?: string[];
    captions?: Record<string, string>;
    sortable?: boolean;
    filterable?: boolean;
    values?: Record<string, unknown>;
}

export function fakeAttribute(options: FakeAttributeOptions): ListAttributeValue<any> {
    const values = options.values ?? {};
    return {
        id: options.id,
        type: options.type,
        universe: options.universe,
        sortable: options.sortable ?? true,
        filterable: options.filterable ?? true,
        isList: false,
        get: (item: ObjectItem) => {
            const value = values[item.id];
            return {
                value,
                displayValue: value === undefined ? "" : value instanceof Big ? value.toString() : String(value),
                readOnly: true,
                status: "available",
                validation: undefined
            };
        },
        formatter: {
            format: (value: unknown) => {
                if (typeof value === "boolean") {
                    return value ? "Yes" : "No";
                }
                if (typeof value === "string" && options.captions?.[value]) {
                    return options.captions[value];
                }
                return value === undefined ? "" : String(value);
            }
        }
    } as unknown as ListAttributeValue<any>;
}

export function fakeColumn(overrides: Partial<ColumnsType> = {}): ColumnsType {
    return {
        columnType: "attribute",
        attribute: undefined,
        dynamicText: undefined,
        content: undefined,
        header: undefined,
        headerGroup: "",
        tooltip: undefined,
        renderAs: "text",
        attributeName: "",
        totalAttribute: undefined,
        widthMode: "flex",
        flex: 1,
        width: 0,
        minWidth: 0,
        maxWidth: 0,
        sortable: true,
        filterType: "auto",
        editable: undefined,
        pinned: "none",
        visible: undefined,
        resizable: true,
        movable: true,
        aggregate: "none",
        alignment: "auto",
        decimalPrecision: -1,
        groupDigits: false,
        wrapText: false,
        autoHeight: false,
        cellClass: undefined,
        onClick: undefined,
        onChange: undefined,
        ...overrides
    } as ColumnsType;
}

export function item(id: string): ObjectItem {
    return { id } as ObjectItem;
}
