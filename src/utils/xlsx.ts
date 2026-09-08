import { strToU8, zipSync } from "fflate";

export type ExcelColumnType = "text" | "number" | "date" | "boolean";

export interface ExcelColumn {
    name: string;
    type: ExcelColumnType;
    /** Decimals for number columns; negative keeps the general format. */
    precision?: number;
    groupDigits?: boolean;
}

export type ExcelCell = string | number | boolean | Date | null | undefined;

function escapeXml(text: string): string {
    return text.replace(/[<>&"']/g, char => {
        switch (char) {
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case "&":
                return "&amp;";
            case '"':
                return "&quot;";
            default:
                return "&apos;";
        }
    });
}

/** Excel column letters: 0 -> A, 25 -> Z, 26 -> AA. */
function columnLetters(index: number): string {
    let letters = "";
    let current = index;
    do {
        letters = String.fromCharCode(65 + (current % 26)) + letters;
        current = Math.floor(current / 26) - 1;
    } while (current >= 0);
    return letters;
}

/** Excel serial date (days since 1899-12-30) in the local time zone, so the sheet shows the same wall-clock time. */
function excelSerial(date: Date): number {
    const local = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    );
    return local / 86400000 + 25569;
}

function numberFormatCode(column: ExcelColumn): string | undefined {
    const precision = column.precision ?? -1;
    if (precision < 0 && !column.groupDigits) {
        return undefined;
    }
    const integer = column.groupDigits ? "#,##0" : "0";
    return precision > 0 ? `${integer}.${"0".repeat(precision)}` : integer;
}

/**
 * Builds a minimal but valid .xlsx workbook: one sheet, bold header row, typed cells, number and date formats.
 * Strings are inline, so no shared string table is needed.
 */
export function buildXlsx(sheetName: string, columns: ExcelColumn[], rows: ExcelCell[][]): Uint8Array {
    // Styles: 0 = default, 1 = bold header, 2 = date/time, 3.. = custom number formats.
    const customFormats: string[] = [];
    const styleIndexByColumn = columns.map(column => {
        if (column.type === "date") {
            return 2;
        }
        const code = column.type === "number" ? numberFormatCode(column) : undefined;
        if (!code) {
            return 0;
        }
        let position = customFormats.indexOf(code);
        if (position < 0) {
            position = customFormats.push(code) - 1;
        }
        return 3 + position;
    });

    const numFmts = customFormats
        .map((code, index) => `<numFmt numFmtId="${164 + index}" formatCode="${escapeXml(code)}"/>`)
        .join("");
    const customXfs = customFormats
        .map((_, index) => `<xf numFmtId="${164 + index}" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>`)
        .join("");
    const styles =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        (customFormats.length ? `<numFmts count="${customFormats.length}">${numFmts}</numFmts>` : "") +
        `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
        `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
        `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="${3 + customFormats.length}">` +
        `<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>` +
        `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/>` +
        `<xf numFmtId="22" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/>` +
        customXfs +
        `</cellXfs></styleSheet>`;

    const cell = (ref: string, value: ExcelCell, style: number): string => {
        const styleAttribute = style ? ` s="${style}"` : "";
        if (value === null || value === undefined || value === "") {
            return style ? `<c r="${ref}"${styleAttribute}/>` : "";
        }
        if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${ref}"${styleAttribute}><v>${value}</v></c>`;
        }
        if (typeof value === "boolean") {
            return `<c r="${ref}" t="b"${styleAttribute}><v>${value ? 1 : 0}</v></c>`;
        }
        if (value instanceof Date) {
            return Number.isNaN(value.getTime())
                ? ""
                : `<c r="${ref}"${styleAttribute}><v>${excelSerial(value)}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeXml(
            String(value)
        )}</t></is></c>`;
    };

    const headerRow =
        `<row r="1">` +
        columns.map((column, index) => cell(`${columnLetters(index)}1`, column.name, 1)).join("") +
        `</row>`;
    const dataRows = rows
        .map((row, rowIndex) => {
            const number = rowIndex + 2;
            const cells = columns
                .map((_, columnIndex) =>
                    cell(`${columnLetters(columnIndex)}${number}`, row[columnIndex], styleIndexByColumn[columnIndex])
                )
                .join("");
            return `<row r="${number}">${cells}</row>`;
        })
        .join("");
    const widths = columns
        .map((column, index) => {
            const width = Math.min(60, Math.max(10, column.name.length + 4));
            return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
        })
        .join("");
    const lastColumn = columnLetters(Math.max(0, columns.length - 1));
    const sheet =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<dimension ref="A1:${lastColumn}${rows.length + 1}"/>` +
        `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
        (columns.length ? `<cols>${widths}</cols>` : "") +
        `<sheetData>${headerRow}${dataRows}</sheetData>` +
        `<autoFilter ref="A1:${lastColumn}${rows.length + 1}"/>` +
        `</worksheet>`;

    const safeSheetName = escapeXml(sheetName.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1");
    const workbook =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const workbookRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`;
    const rootRels =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`;
    const contentTypes =
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `</Types>`;

    return zipSync(
        {
            "[Content_Types].xml": strToU8(contentTypes),
            "_rels/.rels": strToU8(rootRels),
            "xl/workbook.xml": strToU8(workbook),
            "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
            "xl/worksheets/sheet1.xml": strToU8(sheet),
            "xl/styles.xml": strToU8(styles)
        },
        { level: 6 }
    );
}

/** Offers a file for download in the browser. */
export function downloadFile(bytes: Uint8Array, fileName: string, mimeType: string): void {
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
