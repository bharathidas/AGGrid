import { strFromU8, unzipSync } from "fflate";

import { buildXlsx } from "../utils/xlsx";

function unpack(bytes: Uint8Array): Record<string, string> {
    const files = unzipSync(bytes);
    const result: Record<string, string> = {};
    Object.entries(files).forEach(([path, content]) => {
        result[path] = strFromU8(content);
    });
    return result;
}

describe("buildXlsx", () => {
    const columns = [
        { name: "Name", type: "text" as const },
        { name: "Salary", type: "number" as const, precision: 2, groupDigits: true },
        { name: "Hired", type: "date" as const },
        { name: "Active", type: "boolean" as const }
    ];

    it("produces a workbook with the expected parts", () => {
        const files = unpack(buildXlsx("Employees", columns, [["Ann & Co", 1234.5, new Date(2024, 0, 15), true]]));
        expect(Object.keys(files).sort()).toEqual([
            "[Content_Types].xml",
            "_rels/.rels",
            "xl/_rels/workbook.xml.rels",
            "xl/styles.xml",
            "xl/workbook.xml",
            "xl/worksheets/sheet1.xml"
        ]);
        expect(files["xl/workbook.xml"]).toContain('<sheet name="Employees"');
    });

    it("writes typed cells with escaped text, a frozen header and an auto filter", () => {
        const sheet = unpack(buildXlsx("S", columns, [["Ann & Co", 1234.5, new Date(2024, 0, 15), true]]))[
            "xl/worksheets/sheet1.xml"
        ];
        expect(sheet).toContain("Ann &amp; Co");
        expect(sheet).toContain("<v>1234.5</v>");
        expect(sheet).toContain('t="b"');
        expect(sheet).toContain('state="frozen"');
        expect(sheet).toContain('<autoFilter ref="A1:D2"/>');
        // 2024-01-15 is Excel serial 45306.
        expect(sheet).toContain("<v>45306</v>");
    });

    it("registers the custom number format in the styles", () => {
        const styles = unpack(buildXlsx("S", columns, []))["xl/styles.xml"];
        expect(styles).toContain('formatCode="#,##0.00"');
    });

    it("sanitises sheet names", () => {
        const files = unpack(buildXlsx("Bad/Name:With*Chars?[x]", [], []));
        expect(files["xl/workbook.xml"]).toContain('<sheet name="Bad Name With Chars  x "');
    });
});
