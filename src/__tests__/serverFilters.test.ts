import { buildFilter, buildSortOrder } from "../utils/serverFilters";
import { fakeAttribute, fakeColumn } from "./helpers";

const name = fakeAttribute({ id: "attr_name", type: "String" });
const age = fakeAttribute({ id: "attr_age", type: "Integer" });
const hired = fakeAttribute({ id: "attr_hired", type: "DateTime" });
const status = fakeAttribute({
    id: "attr_status",
    type: "Enum",
    universe: ["Active", "Left"],
    captions: { Active: "Active employee", Left: "Left company" }
});
const active = fakeAttribute({ id: "attr_active", type: "Boolean" });
const unsortable = fakeAttribute({ id: "attr_notes", type: "String", sortable: false, filterable: false });

const columns = [
    fakeColumn({ attribute: name }),
    fakeColumn({ attribute: age }),
    fakeColumn({ attribute: hired }),
    fakeColumn({ attribute: status }),
    fakeColumn({ attribute: active }),
    fakeColumn({ attribute: unsortable }),
    fakeColumn({ columnType: "dynamicText" })
];

describe("buildSortOrder", () => {
    it("maps sortable attribute columns and skips the rest", () => {
        const order = buildSortOrder(
            [
                { colId: "col1", sort: "desc" },
                { colId: "col5", sort: "asc" },
                { colId: "col6", sort: "asc" },
                { colId: "unknown", sort: "asc" }
            ],
            columns
        );
        expect(order).toEqual([["attr_age", "desc"]]);
    });
});

describe("buildFilter", () => {
    it("returns undefined without filters or search text", () => {
        expect(buildFilter({}, "   ", columns)).toBeUndefined();
    });

    it("builds a contains condition for text filters", () => {
        const filter = buildFilter({ col0: { filterType: "text", type: "contains", filter: "an" } }, "", columns);
        expect(filter).toEqual({
            name: "contains",
            arg1: { type: "attribute", attributeId: "attr_name" },
            arg2: { type: "literal", value: "an" }
        });
    });

    it("builds number range conditions", () => {
        const filter = buildFilter(
            { col1: { filterType: "number", type: "inRange", filter: 30, filterTo: 40 } },
            "",
            columns
        ) as any;
        expect(filter.name).toBe("and");
        expect(filter.args[0].name).toBe(">=");
        expect(filter.args[0].arg2.value.toString()).toBe("30");
        expect(filter.args[1].name).toBe("<=");
        expect(filter.args[1].arg2.value.toString()).toBe("40");
    });

    it("uses day comparisons for dates", () => {
        const filter = buildFilter(
            { col2: { filterType: "date", type: "equals", dateFrom: "2024-01-15 00:00:00", dateTo: null as any } },
            "",
            columns
        ) as any;
        expect(filter.name).toBe("day:=");
        expect(filter.arg2.value).toBeInstanceOf(Date);
        expect(filter.arg2.value.getFullYear()).toBe(2024);
    });

    it("translates enumeration captions to keys", () => {
        const filter = buildFilter(
            { col3: { filterType: "text", type: "contains", filter: "left" } },
            "",
            columns
        ) as any;
        expect(filter).toEqual({
            name: "=",
            arg1: { type: "attribute", attributeId: "attr_status" },
            arg2: { type: "literal", value: "Left" }
        });
    });

    it("never matches when no caption fits", () => {
        const filter = buildFilter(
            { col3: { filterType: "text", type: "equals", filter: "nope" } },
            "",
            columns
        ) as any;
        expect(filter.name).toBe("and");
        expect(filter.args).toHaveLength(2);
    });

    it("matches boolean captions", () => {
        const filter = buildFilter({ col4: { filterType: "text", type: "equals", filter: "yes" } }, "", columns) as any;
        expect(filter.arg2).toEqual({ type: "literal", value: true });
    });

    it("combines conditions with the model operator", () => {
        const filter = buildFilter(
            {
                col0: {
                    filterType: "text",
                    operator: "OR",
                    conditions: [
                        { filterType: "text", type: "startsWith", filter: "A" },
                        { filterType: "text", type: "endsWith", filter: "z" }
                    ]
                }
            },
            "",
            columns
        ) as any;
        expect(filter.name).toBe("or");
        expect(filter.args.map((part: any) => part.name)).toEqual(["startsWith", "endsWith"]);
    });

    it("ignores filters on columns the server cannot filter", () => {
        expect(
            buildFilter({ col5: { filterType: "text", type: "contains", filter: "x" } }, "", columns)
        ).toBeUndefined();
        expect(
            buildFilter({ col6: { filterType: "text", type: "contains", filter: "x" } }, "", columns)
        ).toBeUndefined();
    });

    it("searches text, caption and numeric columns for the quick filter", () => {
        const filter = buildFilter(undefined, "42", columns) as any;
        expect(filter.name).toBe("or");
        // Name contains "42" and Age equals 42; captions and booleans do not contain "42".
        expect(filter.args.map((part: any) => part.name)).toEqual(["contains", "="]);
    });

    it("ands column filters with the quick filter", () => {
        const filter = buildFilter(
            { col1: { filterType: "number", type: "equals", filter: 5 } },
            "act",
            columns
        ) as any;
        expect(filter.name).toBe("and");
        expect(filter.args).toHaveLength(2);
        // Name contains "act" or Status is the "Active employee" caption.
        expect(filter.args[1].name).toBe("or");
        expect(filter.args[1].args.map((part: any) => part.name)).toEqual(["contains", "="]);
        expect(filter.args[1].args[1].arg2.value).toBe("Active");
    });
});
