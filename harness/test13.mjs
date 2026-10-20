// Browser suite for the 1.3 features: node harness/build.mjs && node harness/test13.mjs
// Tree data, pivot, cell ranges (copy, fill, chart), set filter, side panel, totals rows, styled multi-sheet Excel,
// lazy server groups, failed-commit banner, error boundary, RTL, accessibility checks, a mount/unmount memory
// check and browser timings on 10,000 rows. Prints PASS/FAIL per check and the measured numbers.
import puppeteer from "puppeteer-core";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pageUrl = pathToFileURL(fileURLToPath(new URL("index.html", import.meta.url))).href;

let passed = 0;
let failed = 0;
const numbers = {};
function check(name, ok, detail = "") {
    if (ok) {
        passed++;
        console.log(`PASS ${name}`);
    } else {
        failed++;
        console.log(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
    }
}

const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--js-flags=--expose-gc", "--enable-precise-memory-info"]
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
    const text = message.text();
    // The error boundary test throws on purpose and React reports it.
    if (/Harness crash on purpose|the grid stopped after an error|could not save the object|Network error/.test(text)) {
        return;
    }
    if (message.type() === "error" || (message.type() === "warning" && /AG Grid/i.test(text))) {
        errors.push(text);
    }
});
// Clipboard writes are captured (headless Chrome has no clipboard permission).
await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "clipboard", {
        value: { writeText: text => ((window.__clip = text), Promise.resolve()) },
        configurable: true
    });
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function open(query = "", width = 1280, height = 900) {
    await page.setViewport({ width, height });
    await page.goto(`${pageUrl}${query}`);
    await page.waitForSelector(".ag-row, .mxt-ag-crash", { timeout: 20000 });
    await wait(400);
}

const MAIN = ".mxt-ag-grid__grid";
const cellSel = (rowIndex, colId) => `${MAIN} .ag-row[row-index="${rowIndex}"] .ag-cell[col-id="${colId}"]`;
const visibleRowCount = () =>
    page.evaluate(sel => {
        const indexes = new Set();
        document
            .querySelectorAll(`${sel} .ag-center-cols-viewport .ag-row[row-index], ${sel} .ag-body .ag-row[row-index]`)
            .forEach(row => {
                if (!row.classList.contains("ag-row-pinned")) {
                    indexes.add(row.getAttribute("row-index"));
                }
            });
        return [...indexes].filter(index => /^\d+$/.test(index)).length;
    }, MAIN);
const displayedCount = () =>
    page.evaluate(() => {
        // AG Grid exposes nothing global; count distinct numeric row indexes rendered (all rows fit in 620px or auto height).
        const set = new Set();
        document.querySelectorAll(".mxt-ag-grid__grid .ag-row[row-index]").forEach(row => {
            const index = row.getAttribute("row-index");
            // Rows fading out after a filter change are no longer displayed.
            if (/^\d+$/.test(index) && !row.classList.contains("ag-opacity-zero")) {
                set.add(index);
            }
        });
        return set.size;
    });
const textOf = sel => page.$eval(sel, el => el.textContent.trim()).catch(() => undefined);
const events = name => page.evaluate(n => window.harness.events.filter(e => e.name === n), name);
const value = (id, key) => page.evaluate((i, k) => window.harness.value(i, k), id, key);
async function center(sel) {
    const box = await (await page.$(sel)).boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}
async function drag(fromSel, toSel) {
    const from = await center(fromSel);
    const to = await center(toSel);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
    await wait(150);
}
async function clickButton(text, scope = ".mxt-ag-toolbar") {
    const ok = await page.evaluate(
        (t, s) => {
            const button = [...document.querySelectorAll(`${s} button`)].find(b => b.textContent.includes(t));
            button?.click();
            return Boolean(button);
        },
        text,
        scope
    );
    await wait(250);
    return ok;
}
async function ctrl(key) {
    await page.keyboard.down("Control");
    await page.keyboard.press(key);
    await page.keyboard.up("Control");
    await wait(250);
}
function contrast(fg, bg) {
    const parse = c => c.match(/[\d.]+/g).map(Number);
    const lum = ([r, g, b]) => {
        const f = v => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const a = lum(parse(fg));
    const b = lum(parse(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const colorsOf = sel =>
    page.evaluate(s => {
        const element = document.querySelector(s);
        if (!element) {
            return undefined;
        }
        let node = element;
        let background = "rgba(0, 0, 0, 0)";
        while (node && (background === "rgba(0, 0, 0, 0)" || background === "transparent")) {
            background = getComputedStyle(node).backgroundColor;
            node = node.parentElement;
        }
        if (background === "rgba(0, 0, 0, 0)") {
            background = "rgb(255, 255, 255)";
        }
        return { fg: getComputedStyle(element).color, bg: background };
    }, sel);

// Expected values computed from the harness data (row i: department i%4, city i%3, salary 1000+100i).
const DEPTS = ["Sales", "IT", "Finance", "Support"];
const CITIES = ["Oslo", "Paris", "Rome"];
const salaryOf = i => 1000 + 100 * i;

try {
    // ---- 1. Tree data -----------------------------------------------------------------------------------
    await open("?tree=parent&auto=1&grouping=0");
    check("tree column is shown", Boolean(await page.$('.ag-header-cell[col-id="__mxt_tree__"]')));
    check("all 30 rows shown with every level open", (await displayedCount()) === 30, String(await displayedCount()));
    const firstLabel = await textOf(`${cellSel(0, "__mxt_tree__")} .mxt-ag-tree__label`);
    check("the root row comes first", firstLabel === "e1", firstLabel);
    const rootCount = await textOf(`${cellSel(0, "__mxt_tree__")} .mxt-ag-group__count`);
    check("parent rows show their number of descendants", rootCount === "29", rootCount);
    await page.click(`${cellSel(0, "__mxt_tree__")} .mxt-ag-group__toggle`);
    await wait(300);
    check("collapsing the root hides every other row", (await displayedCount()) === 1, String(await displayedCount()));
    check(
        "the chevron reports aria-expanded=false",
        (await page.$eval(`${cellSel(0, "__mxt_tree__")} button`, el => el.getAttribute("aria-expanded"))) === "false"
    );
    await page.click(`${cellSel(0, "__mxt_tree__")} .mxt-ag-tree__label`);
    await page.keyboard.press("ArrowRight");
    await wait(300);
    check("ArrowRight on a closed row opens it", (await displayedCount()) === 30, String(await displayedCount()));
    await page.keyboard.press("ArrowLeft");
    await wait(300);
    check("ArrowLeft closes it again", (await displayedCount()) === 1);
    await page.click(".mxt-ag-tree-expand");
    await wait(300);
    check("Expand all opens every level", (await displayedCount()) === 30);
    await page.type(".mxt-ag-toolbar__search", "e30");
    await wait(500);
    const filteredLabels = await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-grid__grid .ag-row[row-index] .mxt-ag-tree__label")]
            .map(el => ({ index: Number(el.closest(".ag-row").getAttribute("row-index")), text: el.textContent }))
            .sort((a, b) => a.index - b.index)
            .map(entry => entry.text)
    );
    check(
        "filtering keeps the ancestors of a matching row",
        JSON.stringify(filteredLabels) === JSON.stringify(["e1", "e2", "e6", "e30"]),
        JSON.stringify(filteredLabels)
    );
    check(
        "ancestors kept for context are marked",
        (await page.$$eval(
            ".ag-row.mxt-ag-row-tree-context",
            rows => new Set(rows.map(r => r.getAttribute("row-index"))).size
        )) === 3
    );
    await page.click(".mxt-ag-toolbar__search", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await wait(400);
    await page.click(".mxt-ag-tree-collapse");
    await wait(300);
    check("Collapse all shows only the top level", (await displayedCount()) === 1);

    // 1.3.1: parent keys that arrive after the rows (an expression over an association) still build the tree.
    await open("?tree=parent&auto=1&grouping=0&lateParent=1");
    check(
        "while the parent keys load every row is a top-level row",
        (await displayedCount()) === 30,
        String(await displayedCount())
    );
    await page.evaluate(() => window.harness.releaseParents());
    await wait(500);
    const lateCount = await textOf(`${cellSel(0, "__mxt_tree__")} .mxt-ag-group__count`);
    check("the rebuilt tree cells are repainted (descendant count)", lateCount === "29", lateCount);
    const lateIndent = await page
        .$eval(`${cellSel(1, "__mxt_tree__")} .mxt-ag-tree`, el => el.style.paddingInlineStart)
        .catch(() => "");
    check(
        "the rebuilt tree cells are repainted (indentation)",
        Boolean(lateIndent) && lateIndent !== "0px",
        lateIndent
    );
    await page.click(`${cellSel(0, "__mxt_tree__")} .mxt-ag-group__toggle`);
    await wait(300);
    check(
        "late parent keys rebuild the tree (collapsing the root hides the rest)",
        (await displayedCount()) === 1,
        String(await displayedCount())
    );

    await open("?tree=parent&auto=1&grouping=0&treeAgg=1");
    const rootSalary = await textOf(cellSel(0, "col3"));
    check("a parent shows the sum of its descendants (aggregate per parent)", rootSalary === "72500", rootSalary);

    await open("?tree=path&depth=1&auto=1&grouping=0");
    check(
        "path tree: generated department and city levels (depth 1)",
        (await displayedCount()) === 16,
        String(await displayedCount())
    );
    const generated = await page.$$eval(
        ".ag-row.mxt-ag-row-tree-filler",
        rows => new Set(rows.map(r => r.getAttribute("row-index"))).size
    );
    check("path tree: generated levels are marked", generated === 16, String(generated));
    await clickButton("Export Excel");
    await wait(700);
    const treeXlsx = await page.evaluate(() => window.harness.downloads.at(-1)?.text ?? "");
    check(
        "tree Excel export has a Hierarchy column and outline levels",
        treeXlsx.includes("Hierarchy") && treeXlsx.includes('outlineLevel="2"'),
        treeXlsx.slice(0, 160)
    );

    // ---- 2. Pivot ---------------------------------------------------------------------------------------------
    await page.evaluate(() => localStorage.clear());
    await open("?pivot=1&pivotStart=1&panel=1&auto=1");
    await page.waitForSelector(".mxt-ag-pivot .ag-row");
    check("Start in pivot mode shows the pivot table", Boolean(await page.$(".mxt-ag-pivot")));
    check("the data grid is hidden while pivoting", await page.$eval(MAIN, el => el.hidden));
    const pivotHeaders = await page.$$eval(
        ".mxt-ag-pivot .ag-header-group-cell, .mxt-ag-pivot .ag-header-cell",
        cells => cells.map(c => c.textContent.trim()).filter(Boolean)
    );
    check(
        "generated column labels per city and a total column",
        ["Oslo", "Paris", "Rome"].every(city => pivotHeaders.includes(city)) &&
            pivotHeaders.some(h => h.startsWith("Total")),
        JSON.stringify(pivotHeaders)
    );
    const pivotRows = await page.$$eval(
        ".mxt-ag-pivot .ag-row[row-index]",
        rows => [...new Set(rows.map(r => r.getAttribute("row-index")))].filter(index => /^\d+$/.test(index)).length
    );
    check("one pivot row per department", pivotRows === 4, String(pivotRows));
    let salesOslo = 0;
    for (let i = 0; i < 30; i++) {
        if (DEPTS[i % 4] === "Sales" && CITIES[i % 3] === "Oslo") {
            salesOslo += salaryOf(i);
        }
    }
    const salesOsloShown = await page.evaluate(() => {
        const row = [...document.querySelectorAll(".mxt-ag-pivot .ag-row")].find(r => r.textContent.includes("Sales"));
        const index = row?.getAttribute("row-index");
        return document.querySelector(`.mxt-ag-pivot .ag-row[row-index="${index}"] [col-id="p0_0"]`)?.textContent;
    });
    check(
        "pivot cell holds the sum for Sales x Oslo",
        salesOsloShown === String(salesOslo),
        `${salesOsloShown} vs ${salesOslo}`
    );
    const grand = await page
        .$eval(".mxt-ag-pivot .ag-row[row-index='b-0'] [col-id='pt_0']", el => el.textContent)
        .catch(() => "");
    check("grand total row sums every salary", grand === "73500", grand);
    await page.type(".mxt-ag-toolbar__search", "Oslo");
    await wait(600);
    const filteredHeaders = await page.$$eval(".mxt-ag-pivot .ag-header-group-cell", cells =>
        cells.map(c => c.textContent.trim())
    );
    check(
        "the pivot follows the quick search",
        filteredHeaders.includes("Oslo") && !filteredHeaders.includes("Paris"),
        JSON.stringify(filteredHeaders)
    );
    await page.click(".mxt-ag-toolbar__search", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await wait(500);
    // Side panel: change the value function to average.
    await clickButton("Panel");
    const fnSelect = await page.$(".mxt-ag-panel__fn");
    check("side panel shows the Values zone with a function choice", Boolean(fnSelect));
    await fnSelect.select("avg");
    await wait(400);
    const avgHeader = await page.$$eval(".mxt-ag-pivot .ag-header-cell", cells => cells.map(c => c.textContent.trim()));
    check(
        "changing the value function re-pivots",
        avgHeader.some(h => h.startsWith("Average(Salary)")),
        JSON.stringify(avgHeader.slice(0, 4))
    );
    // Saved view keeps the pivot.
    const viewsButton = await page.$$eval(".mxt-ag-toolbar button", buttons =>
        buttons.findIndex(b => b.textContent.includes("Views"))
    );
    if (viewsButton >= 0) {
        await page.evaluate(() =>
            [...document.querySelectorAll(".mxt-ag-toolbar button")].find(b => b.textContent.includes("Views")).click()
        );
        await wait(200);
        await page.evaluate(() =>
            [...document.querySelectorAll("[role=menuitem]")]
                .find(b => b.textContent.includes("Save current view"))
                .click()
        );
        await wait(200);
        await page.type('input[aria-label="View name"]', "Pivot view");
        await page.evaluate(() =>
            [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Save").click()
        );
        await wait(300);
    }
    const storedView = await page.evaluate(() => localStorage.getItem("mxt-aggrid-views:harnessGrid") ?? "");
    check(
        "a saved view stores the pivot layout",
        storedView.includes('"pivot"') && storedView.includes('"avg"'),
        storedView.slice(0, 120)
    );
    check(
        "a saved view remembers the open side panel",
        storedView.includes('"sidePanel":{"open":true'),
        storedView.slice(-160)
    );
    await clickButton("Export Excel");
    await wait(800);
    const pivotBook = await page.evaluate(() => window.harness.downloads.at(-1)?.files ?? {});
    const workbookXml = pivotBook["xl/workbook.xml"] ?? "";
    check(
        "Excel export adds a Pivot sheet",
        workbookXml.includes('name="Data"') && workbookXml.includes('name="Pivot"'),
        workbookXml.slice(-200)
    );
    check(
        "the Pivot sheet has the column labels as header rows",
        (pivotBook["xl/worksheets/sheet2.xml"] ?? "").includes("Oslo")
    );
    await page.click(".mxt-ag-pivot-toggle");
    await wait(300);
    check(
        "the Pivot button switches back to the data grid",
        !(await page.$(".mxt-ag-pivot")) && !(await page.$eval(MAIN, el => el.hidden))
    );
    await page.evaluate(() => localStorage.clear());

    // ---- 3. Cell ranges, copy, fill, chart -----------------------------------------------------------------------
    await open("?range=1&auto=1&density=0");
    await drag(cellSel(0, "col3"), cellSel(2, "col4"));
    const rangeCells = await page.$$eval(`${MAIN} .ag-cell.mxt-ag-range-cell`, cells => cells.length);
    check("dragging selects a 3 x 2 cell range", rangeCells === 6, String(rangeCells));
    const rangeStatus = await textOf(".mxt-ag-status__range");
    check(
        "the status bar shows count, sum and average of the range",
        /Count\s*6/.test(rangeStatus ?? "") && rangeStatus.includes("3,311"),
        rangeStatus
    );
    await page.click(cellSel(2, "col4")).catch(() => undefined);
    await page.click(cellSel(0, "col3"));
    await page.keyboard.down("Shift");
    await page.click(cellSel(2, "col4"));
    await page.keyboard.up("Shift");
    await wait(150);
    check(
        "Shift+click extends the range",
        (await page.$$eval(`${MAIN} .ag-cell.mxt-ag-range-cell`, c => c.length)) === 6
    );
    await ctrl("c");
    const clip = await page.evaluate(() => window.__clip ?? "");
    check(
        "Ctrl+C copies the range as tab separated text",
        clip === "1000\t0\r\n1100\t7\r\n1200\t4",
        JSON.stringify(clip)
    );
    await page.keyboard.press("Escape");
    await page.click(cellSel(0, "col0"));
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.up("Shift");
    await wait(150);
    check(
        "Shift+arrow keys extend the range",
        (await page.$$eval(`${MAIN} .ag-cell.mxt-ag-range-cell`, c => c.length)) === 6
    );
    // Fill handle: Rating 0, 7 continues as 14, 21.
    await drag(cellSel(0, "col4"), cellSel(1, "col4"));
    const handle = await center(`${MAIN} .ag-cell.mxt-ag-range-handle`);
    const target = await center(cellSel(3, "col4"));
    await page.mouse.move(handle.box.x + handle.box.width - 3, handle.box.y + handle.box.height - 3);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 6 });
    await page.mouse.up();
    await wait(400);
    check(
        "the fill handle continues a series through the edit path",
        (await value("e3", "rating")) === "14" && (await value("e4", "rating")) === "21",
        `${await value("e3", "rating")} ${await value("e4", "rating")}`
    );
    check(
        "On fill runs with the number of cells",
        (await events("onFill")).at(-1)?.args?.cellCount === 2,
        JSON.stringify(await events("onFill"))
    );
    check(
        "the range grows over the filled cells",
        (await page.$$eval(`${MAIN} .ag-cell.mxt-ag-range-cell`, c => c.length)) === 4
    );
    await ctrl("z");
    check(
        "one Ctrl+Z undoes the whole fill",
        (await value("e3", "rating")) === "4" && (await value("e4", "rating")) === "1",
        `${await value("e3", "rating")} ${await value("e4", "rating")}`
    );
    await drag(cellSel(5, "col0"), cellSel(7, "col0"));
    await ctrl("d");
    check("Ctrl+D fills down from the first row", (await value("e8", "name")) === "Fay 6", await value("e8", "name"));
    await ctrl("z");
    check("Ctrl+Z restores the filled-down cells", (await value("e8", "name")) === "Hal 8");
    // Chart range.
    await drag(cellSel(0, "col0"), cellSel(4, "col3"));
    await clickButton("Chart range");
    await page.waitForSelector(".mxt-ag-chart[role=dialog]");
    check(
        "Chart range opens a dialog with one bar per row",
        (await page.$$eval(".mxt-ag-chart__bar", bars => bars.length)) === 5
    );
    check(
        "the chart has an accessible data table",
        (await page.$$eval(".mxt-ag-chart table tbody tr", rows => rows.length)) === 5
    );
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-chart__types button")].find(b => b.textContent === "Line").click()
    );
    await wait(150);
    check("Line draws a line with markers", (await page.$$eval(".mxt-ag-chart__dot", dots => dots.length)) === 5);
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-chart__types button")].find(b => b.textContent === "Pie").click()
    );
    await wait(150);
    check("Pie draws one slice per row", (await page.$$eval(".mxt-ag-chart__slice", slices => slices.length)) === 5);
    await page.keyboard.press("Escape");
    await wait(200);
    check("Escape closes the chart", !(await page.$(".mxt-ag-chart")));
    await clickButton("Export Excel");
    await wait(800);
    const rangeBook = await page.evaluate(() => window.harness.downloads.at(-1)?.files ?? {});
    check(
        "Excel export adds a Selection sheet with the range",
        (rangeBook["xl/workbook.xml"] ?? "").includes('name="Selection"') &&
            ((rangeBook["xl/worksheets/sheet2.xml"] ?? "").match(/<row /g) ?? []).length === 6
    );

    // ---- 4. Set filter ------------------------------------------------------------------------------------------------
    await open("?set=1&ff=1&auto=1");
    const setButtons = await page.$$(".mxt-ag-set-floating__button");
    check("set filter columns get a checklist floating filter", setButtons.length === 2, String(setButtons.length));
    await setButtons[0].click();
    await page.waitForSelector(".mxt-ag-set-popover");
    const listed = await page.$$eval(".mxt-ag-set-popover .mxt-ag-set__list label", labels =>
        labels.map(l => l.textContent)
    );
    check(
        "the checklist lists the distinct values",
        JSON.stringify(listed) === JSON.stringify(["Finance", "IT", "Sales", "Support"]),
        JSON.stringify(listed)
    );
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-set-popover label")]
            .find(l => l.textContent === "IT")
            .querySelector("input")
            .click()
    );
    await wait(400);
    check("unchecking a value filters its rows out", (await displayedCount()) === 22, String(await displayedCount()));
    await page.type(".mxt-ag-set-popover input[type=search]", "fin");
    await wait(150);
    check(
        "the search narrows the list",
        (await page.$$eval(".mxt-ag-set-popover .mxt-ag-set__list label", labels => labels.length)) === 1
    );
    await page.keyboard.press("Escape");
    await wait(200);
    const summary = await textOf(".mxt-ag-set-floating__text");
    check("the floating filter shows the choice", summary === "3 / 4", summary);
    const setButtons2 = await page.$$(".mxt-ag-set-floating__button");
    await setButtons2[1].click();
    await page.waitForSelector(".mxt-ag-set-popover");
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-set-popover label")]
            .find(l => l.textContent === "(Blanks)")
            .querySelector("input")
            .click()
    );
    await wait(400);
    // e10 and e30 are IT (already filtered out); only e20 has no level among the rest.
    check("(Blanks) filters empty values", (await displayedCount()) === 21, String(await displayedCount()));
    await page.keyboard.press("Escape");

    // ---- 5. Side panel --------------------------------------------------------------------------------------------------
    await open("?panel=1&panelOpen=1&auto=1&set=1");
    check("Start open shows the side panel", Boolean(await page.$(".mxt-ag-panel")));
    check("the panel lists every data column", (await page.$$eval(".mxt-ag-panel__column", rows => rows.length)) === 9);
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-panel__check")]
            .find(l => l.textContent === "City")
            .querySelector("input")
            .click()
    );
    await wait(300);
    check("unchecking a column hides it", !(await page.$('.ag-header-cell[col-id="col2"]')));
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-panel__column")]
            .find(r => r.textContent.includes("Department"))
            .querySelector(".mxt-ag-panel__actions button")
            .click()
    );
    await wait(200);
    const zoneItems = await page.$$eval(".mxt-ag-panel__menu [data-zone]", items => items.map(i => i.dataset.zone));
    check(
        "the column menu offers the row group zone (keyboard alternative to dragging)",
        zoneItems.includes("rows"),
        JSON.stringify(zoneItems)
    );
    await page.evaluate(() => document.querySelector('.mxt-ag-panel__menu [data-zone="rows"]').click());
    await wait(400);
    check(
        "adding a column to Row Groups groups the grid",
        (await page.$$eval(".ag-row.mxt-ag-row-group", rows => rows.length)) > 0
    );
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-panel__chip button")]
            .find(b => b.getAttribute("aria-label")?.includes("Remove"))
            .click()
    );
    await wait(300);
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-panel__column")]
            .find(r => r.textContent.includes("Salary"))
            .querySelector(".mxt-ag-panel__actions button")
            .click()
    );
    await wait(150);
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-panel__menu [role=menuitem]")]
            .find(b => b.textContent.includes("Move up"))
            .click()
    );
    await wait(300);
    const order = await page.$$eval(".mxt-ag-panel__check span", spans => spans.map(s => s.textContent));
    check("Move up reorders the columns", order.indexOf("Salary") < order.indexOf("City"), JSON.stringify(order));
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-panel__tab")].find(t => t.textContent.startsWith("Filters")).click()
    );
    await wait(200);
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-panel__filter-toggle")].find(t => t.textContent.includes("Name")).click()
    );
    await wait(150);
    await page.type(".mxt-ag-panel__condition input", "Ann");
    await wait(700);
    check(
        "a condition in the Filters section filters the grid",
        (await displayedCount()) === 3,
        String(await displayedCount())
    );
    check("the Filters tab shows how many filters are active", (await textOf(".mxt-ag-panel__badge")) === "1");
    await page.evaluate(() => document.querySelector(".mxt-ag-panel__clear").click());
    await wait(400);
    check("Clear removes the filter", (await displayedCount()) === 30);
    await page.focus(".mxt-ag-panel__tab.is-active");
    await page.keyboard.press("ArrowLeft");
    await wait(150);
    check("arrow keys switch the panel tabs", (await textOf(".mxt-ag-panel__tab.is-active"))?.startsWith("Columns"));

    // ---- 6. Totals rows: top and bottom, user can change the function -----------------------------------------
    await open("?totals=both&tchange=1&auto=1");
    const topSalary = await page
        .$eval(".ag-row[row-index='t-0'] [col-id='col3']", el => el.textContent)
        .catch(() => "");
    const bottomSalary = await page
        .$eval(".ag-row[row-index='b-0'] [col-id='col3']", el => el.textContent)
        .catch(() => "");
    check("Top and bottom: the top row uses the top totals value (average)", topSalary === "2450", topSalary);
    check("Top and bottom: the bottom row sums", bottomSalary === "73500", bottomSalary);
    await page.click(".ag-row[row-index='b-0'] [col-id='col3']");
    await page.waitForSelector(".mxt-ag-totals-menu");
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-totals-menu button")].find(b => b.textContent === "Max").click()
    );
    await wait(300);
    check(
        "choosing Max in the totals menu changes the cell",
        (await page.$eval(".ag-row[row-index='b-0'] [col-id='col3']", el => el.textContent)) === "3900"
    );
    await page.click(".ag-row[row-index='b-0'] [col-id='col0']");
    await page.waitForSelector(".mxt-ag-totals-menu");
    const textChoices = await page.$$eval(".mxt-ag-totals-menu button", buttons => buttons.map(b => b.textContent));
    check(
        "text columns offer count and distinct count only",
        JSON.stringify(textChoices) === JSON.stringify(["None", "Count", "Distinct count"]),
        JSON.stringify(textChoices)
    );
    await page.keyboard.press("Escape");
    await wait(150);
    check("Escape closes the totals menu", !(await page.$(".mxt-ag-totals-menu")));
    await page.focus(".ag-row[row-index='t-0'] [col-id='col3']");
    await page.keyboard.press("Enter");
    await wait(200);
    check("Enter on a totals cell opens the menu (keyboard)", Boolean(await page.$(".mxt-ag-totals-menu[role=menu]")));
    const focusedItem = await page.evaluate(() => document.activeElement?.getAttribute("aria-checked"));
    check("the menu focuses the current function", focusedItem === "true", String(focusedItem));
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await wait(250);
    const topAfter = await page.$eval(".ag-row[row-index='t-0'] [col-id='col3']", el => el.textContent);
    check("choosing with the keyboard changes the top totals cell", topAfter === "1000", topAfter);
    await page.type(".mxt-ag-toolbar__search", "Sales");
    await wait(500);
    check(
        "totals follow the quick search",
        (await page.$eval(".ag-row[row-index='b-0'] [col-id='col3']", el => el.textContent)) === "3800"
    );

    // ---- 7. Styled Excel with formulas -------------------------------------------------------------------------------------
    await open("?totals=bottom&auto=1");
    await clickButton("Export Excel");
    await wait(700);
    const styled = await page.evaluate(() => window.harness.downloads.at(-1)?.files ?? {});
    const sheet1 = styled["xl/worksheets/sheet1.xml"] ?? "";
    check("styled Excel: header fill in the styles", (styled["xl/styles.xml"] ?? "").includes('patternType="solid"'));
    check(
        "styled Excel: native data bar and icon set",
        sheet1.includes('type="dataBar"') && sheet1.includes('iconSet="3Arrows"')
    );
    check(
        "styled Excel: totals row as SUBTOTAL formula",
        sheet1.includes("<f>SUBTOTAL(109,D2:D31)</f>"),
        sheet1.slice(-400)
    );
    check("styled Excel: column widths from the grid", /<col min="1" max="1" width="\d+"/.test(sheet1));
    check(
        "single sheet keeps the file name as sheet name",
        (styled["xl/workbook.xml"] ?? "").includes('name="people"')
    );
    await open("?totals=bottom&auto=1&styled=0");
    await clickButton("Export Excel");
    await wait(700);
    const plain = await page.evaluate(() => window.harness.downloads.at(-1)?.text ?? "");
    check(
        "Styled Excel = No writes the plain 1.2 layout",
        !plain.includes("conditionalFormatting") && !plain.includes("SUBTOTAL")
    );

    // ---- 8. Lazy server groups ------------------------------------------------------------------------------------------------
    await open("?server=1&sgroup=1&pageSize=5");
    await page.click(".mxt-ag-groupby > button");
    await page.waitForSelector(".mxt-ag-groupby__menu");
    const serverColumns = await page.$$eval(".mxt-ag-groupby__menu [data-menuitem]", items =>
        items.map(i => i.textContent)
    );
    check(
        "server grouping offers enumeration and boolean columns only",
        serverColumns.some(t => t.includes("Level")) &&
            serverColumns.some(t => t.includes("Active")) &&
            !serverColumns.some(t => t.includes("City")),
        JSON.stringify(serverColumns)
    );
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-groupby__menu [data-menuitem]")]
            .find(i => i.textContent.includes("Level"))
            .click()
    );
    await page.keyboard.press("Escape");
    await page
        .waitForFunction(() => document.querySelectorAll(".mxt-ag-grid__grid .ag-row.mxt-ag-row-group").length >= 4, {
            timeout: 8000
        })
        .catch(() => undefined);
    await wait(600);
    const counts = await page.$$eval(".mxt-ag-grid__grid .ag-row.mxt-ag-row-group .mxt-ag-group", groups =>
        groups.map(
            g =>
                `${g.querySelector(".mxt-ag-group__label").textContent}=${
                    g.querySelector(".mxt-ag-group__count").textContent
                }`
        )
    );
    const expected = { Junior: 0, Senior: 0, Lead: 0, "(empty)": 0 };
    for (let i = 0; i < 30; i++) {
        expected[i % 10 === 9 ? "(empty)" : ["Junior", "Senior", "Lead"][i % 3]]++;
    }
    check(
        "group rows show the counts the data source reports",
        ["Junior", "Senior", "Lead", "(empty)"].every(label => counts.includes(`${label}=${expected[label]}`)),
        JSON.stringify(counts)
    );
    const before = await page.evaluate(() => window.harness.serverRequests());
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-group")]
            .find(g => g.textContent.includes("Junior"))
            .querySelector("button")
            .click()
    );
    await page.waitForSelector(".mxt-ag-loadmore__button", { timeout: 6000 }).catch(() => undefined);
    await wait(300);
    check(
        "expanding a group loads its first page from the data source",
        (await displayedCount()) >= 4 + 5 + 1 - 1 &&
            (await page.evaluate(() => window.harness.serverRequests())) > before
    );
    const lazyRow = await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-grid__grid .ag-row[row-index]")]
            .find(r => !r.classList.contains("mxt-ag-row-group") && !r.classList.contains("mxt-ag-row-loadmore"))
            ?.getAttribute("row-index")
    );
    await page.click(cellSel(lazyRow, "col0"), { clickCount: 2 });
    await wait(200);
    check("rows of a lazy group are read-only snapshots (no editor opens)", !(await page.$(".ag-cell-inline-editing")));
    await page.keyboard.press("Escape");
    const moreText = await textOf(".mxt-ag-loadmore__button");
    check("a Load more row tells how many rows are loaded", moreText?.includes(`5 / ${expected.Junior}`), moreText);
    await page.click(".mxt-ag-loadmore__button");
    await page.waitForFunction(
        () =>
            !document.querySelector(".mxt-ag-loadmore__button") ||
            !document.querySelector(".mxt-ag-loadmore__button").disabled,
        { timeout: 6000 }
    );
    await wait(400);
    const juniorRows = await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-grid__grid .ag-row[row-index]")]
            .filter(r => !r.classList.contains("mxt-ag-row-group") && !r.classList.contains("mxt-ag-row-loadmore"))
            .map(r => r.getAttribute("row-index"))
    );
    check(
        "Load more appends the next page",
        new Set(juniorRows).size === expected.Junior,
        String(new Set(juniorRows).size)
    );
    await page.type(".mxt-ag-toolbar__search", "Ann");
    await wait(1500);
    const searched = await page.$$eval(".mxt-ag-grid__grid .ag-row.mxt-ag-row-group", rows => rows.length);
    check(
        "the quick search recounts the groups on the server (empty groups disappear)",
        searched < 4,
        String(searched)
    );
    await page.click(".mxt-ag-groupby > button");
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-groupby__menu button")]
            .find(b => b.textContent.includes("Ungroup"))
            .click()
    );
    await wait(1200);
    check(
        "ungrouping returns to paged server rows",
        (await page.$$eval(".ag-row.mxt-ag-row-group", rows => rows.length)) === 0 && (await displayedCount()) > 0
    );

    // 1.3.1: with pagination on, lazy server groups are not split over client pages (the Load more row pages).
    await open("?server=1&sgroup=1&pageSize=5&paged=1");
    await page.click(".mxt-ag-groupby > button");
    await page.waitForSelector(".mxt-ag-groupby__menu");
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-groupby__menu [data-menuitem]")]
            .find(i => i.textContent.includes("Level"))
            .click()
    );
    await page.keyboard.press("Escape");
    await page
        .waitForFunction(() => document.querySelectorAll(".mxt-ag-grid__grid .ag-row.mxt-ag-row-group").length >= 4, {
            timeout: 8000
        })
        .catch(() => undefined);
    await wait(600);
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-group")]
            .find(g => g.textContent.includes("Junior"))
            .querySelector("button")
            .click()
    );
    await page.waitForSelector(".mxt-ag-loadmore__button", { timeout: 6000 }).catch(() => undefined);
    await wait(400);
    check(
        "paged grid: an opened server group shows its Load more row",
        Boolean(await page.$(".mxt-ag-loadmore__button")),
        await page.evaluate(() =>
            [...document.querySelectorAll(".mxt-ag-grid__grid .ag-row[row-index]")]
                .map(r => r.getAttribute("row-index") + ":" + r.textContent.trim().slice(0, 16))
                .join(" | ")
        )
    );
    check(
        "paged grid: the other groups stay visible below the opened one",
        new Set(
            await page.$$eval(".mxt-ag-grid__grid .ag-row.mxt-ag-row-group", rows =>
                rows.map(r => r.getAttribute("row-index"))
            )
        ).size === 4
    );
    check("paged grid: the pager is hidden while grouped on the server", !(await page.$(".mxt-ag-pager")));

    // ---- 9. Failed commits: banner with Retry and Discard ---------------------------------------------------------------------
    await open("?commit=fail&auto=1");
    await page.click(cellSel(0, "col0"), { clickCount: 2 });
    await wait(200);
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.type("Zed");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".mxt-ag-commit--failed", { timeout: 4000 }).catch(() => undefined);
    const banner = await textOf(".mxt-ag-commit--failed");
    check(
        "a failed save shows a banner instead of being lost",
        banner?.includes("1 change(s) could not be saved."),
        banner
    );
    check(
        "the banner is announced (role=alert)",
        (await page.$eval(".mxt-ag-commit--failed", el => el.getAttribute("role")).catch(() => "")) === "alert"
    );
    await clickButton("Retry", ".mxt-ag-commit");
    await wait(400);
    check(
        "Retry saves again and clears the banner",
        !(await page.$(".mxt-ag-commit--failed")) && (await events("commit")).length === 1
    );
    await page.evaluate(() => window.harness.setFailCommits(1));
    await page.click(cellSel(1, "col0"), { clickCount: 2 });
    await wait(200);
    await page.keyboard.down("Control");
    await page.keyboard.press("a");
    await page.keyboard.up("Control");
    await page.keyboard.type("Yan");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".mxt-ag-commit--failed", { timeout: 4000 }).catch(() => undefined);
    await clickButton("Discard", ".mxt-ag-commit");
    await wait(500);
    check(
        "Discard rolls the cell back to its old value",
        (await value("e2", "name")) === "Bob 2",
        await value("e2", "name")
    );

    // ---- 10. Error boundary ----------------------------------------------------------------------------------------------------------
    await open("?crash=1");
    check(
        "an error shows the recovery panel instead of a blank page",
        Boolean(await page.$(".mxt-ag-crash[role=alert]"))
    );
    await page.evaluate(() => (window.harnessCrash = false));
    await page.click(".mxt-ag-crash__retry");
    await page.waitForSelector(".ag-row", { timeout: 8000 }).catch(() => undefined);
    check("Retry draws the grid again", Boolean(await page.$(".ag-row")) && !(await page.$(".mxt-ag-crash")));

    // ---- 11. Right to left --------------------------------------------------------------------------------------------------------------
    await open("?rtl=1&range=1&panel=1&panelOpen=1&tree=parent&grouping=0");
    check("RTL pages get an RTL grid (enableRtl)", Boolean(await page.$(".mxt-ag-grid .ag-rtl")));
    const rtlOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check("no page overflow in RTL", rtlOverflow <= 0, String(rtlOverflow));
    const panelLeft = await page.evaluate(
        () =>
            document.querySelector(".mxt-ag-grid__panel").getBoundingClientRect().left <
            document.querySelector(".mxt-ag-grid__grid").getBoundingClientRect().left
    );
    check("the side panel sits at the inline end (left) in RTL", panelLeft);
    await page.click(cellSel(1, "col1"));
    await page.keyboard.down("Shift");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.up("Shift");
    await wait(150);
    const rtlRange = await page.$$eval(`${MAIN} .ag-cell.mxt-ag-range-cell`, cells =>
        cells.map(c => c.getAttribute("col-id"))
    );
    check("Shift+ArrowLeft extends to the next column in RTL", rtlRange.includes("col2"), JSON.stringify(rtlRange));

    // ---- 12. Accessibility --------------------------------------------------------------------------------------------------------------
    await open("?panel=1&panelOpen=1&pivot=1&range=1&tree=&set=1&ff=1&totals=both&tchange=1");
    const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-grid button, .mxt-ag-grid input, .mxt-ag-grid select")]
            .filter(el => !el.closest(".ag-root-wrapper") || el.closest(".ag-floating-filter"))
            .filter(
                el =>
                    !(
                        el.getAttribute("aria-label") ||
                        el.textContent.trim() ||
                        el.closest("label") ||
                        el.getAttribute("aria-labelledby")
                    )
            )
            .map(el => el.outerHTML.slice(0, 80))
    );
    check("every widget control has an accessible name", unnamed.length === 0, JSON.stringify(unnamed.slice(0, 3)));
    const pairs = [
        ".mxt-ag-panel__tab.is-active",
        ".mxt-ag-panel__check span",
        ".mxt-ag-panel__zone-empty",
        ".mxt-ag-status__rows",
        ".mxt-ag-toolbar .mxt-ag-btn span",
        ".mxt-ag-set-floating__text"
    ];
    for (const sel of pairs) {
        const colors = await colorsOf(sel);
        const ratio = colors ? contrast(colors.fg, colors.bg) : 0;
        check(`contrast >= 4.5:1 for ${sel}`, ratio >= 4.5, `${ratio.toFixed(2)} ${JSON.stringify(colors)}`);
    }
    await open("?panel=1&panelOpen=1&dark=1");
    for (const sel of [".mxt-ag-panel__tab.is-active", ".mxt-ag-panel__zone-empty", ".mxt-ag-panel__check span"]) {
        const colors = await colorsOf(sel);
        const ratio = colors ? contrast(colors.fg, colors.bg) : 0;
        check(`dark contrast >= 4.5:1 for ${sel}`, ratio >= 4.5, `${ratio.toFixed(2)} ${JSON.stringify(colors)}`);
    }
    // 200% zoom of a 1280px window = 640 CSS pixels.
    await open("?panel=1&panelOpen=1&range=1&auto=1", 640, 900);
    const zoomOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check("200% zoom (640 CSS px): no horizontal page scroll", zoomOverflow <= 0, String(zoomOverflow));
    const stacked = await page.evaluate(
        () =>
            document.querySelector(".mxt-ag-grid__panel").getBoundingClientRect().top >=
            document.querySelector(".mxt-ag-grid__grid").getBoundingClientRect().bottom - 1
    );
    check("200% zoom: the side panel moves under the grid", stacked);
    // Keyboard focus order: Tab from the search box reaches the toolbar buttons in visual order.
    await page.focus(".mxt-ag-toolbar__search");
    const tabOrder = [];
    for (let step = 0; step < 6; step++) {
        await page.keyboard.press("Tab");
        tabOrder.push(
            await page.evaluate(
                () =>
                    document.activeElement?.textContent?.trim() ||
                    document.activeElement?.getAttribute("aria-label") ||
                    document.activeElement?.className
            )
        );
    }
    check(
        "Tab moves through the toolbar in order",
        tabOrder.indexOf("Panel") >= 0 && tabOrder.indexOf("Panel") < tabOrder.findIndex(t => /Reset/.test(t)),
        JSON.stringify(tabOrder)
    );

    // ---- 13. Memory: mount / unmount loop -----------------------------------------------------------------------------------------------------------
    await open("?range=1&panel=1&panelOpen=1&totals=bottom");
    const heap = async () =>
        page.evaluate(async () => {
            window.gc?.();
            await new Promise(resolve => setTimeout(resolve, 100));
            window.gc?.();
            return performance.memory?.usedJSHeapSize ?? 0;
        });
    const cycle = async count => {
        for (let index = 0; index < count; index++) {
            await page.evaluate(() => window.harness.unmount());
            await page.evaluate(() => window.harness.mount());
            // Dispose the handle: puppeteer handles keep DOM nodes alive and would look like a leak.
            await (await page.waitForSelector(".ag-row")).dispose();
            await wait(60);
        }
    };
    await cycle(10);
    const heapStart = await heap();
    await cycle(25);
    const heapEnd = await heap();
    numbers.heapStartMB = +(heapStart / 1048576).toFixed(1);
    numbers.heapAfter25CyclesMB = +(heapEnd / 1048576).toFixed(1);
    check(
        "mount/unmount 25 times: heap stays stable (< 2 MB growth after warm-up)",
        heapStart > 0 && heapEnd - heapStart < 2 * 1048576,
        `${numbers.heapStartMB} MB -> ${numbers.heapAfter25CyclesMB} MB`
    );
    check(
        "unmount leaves no portals behind",
        (await page.$$(".mxt-ag-set-popover, .mxt-ag-totals-menu, .mxt-ag-chart-backdrop")).length === 0
    );

    // ---- 14. Timings on 10,000 rows ---------------------------------------------------------------------------------------------------------------------
    const timed = async query => {
        const start = Date.now();
        await page.goto(`${pageUrl}${query}`);
        await page.waitForSelector(".ag-row", { timeout: 60000 });
        return Date.now() - start;
    };
    numbers.load10k = await timed("?rows=10000&grouping=0&status=0");
    const sortMs = await page.evaluate(async () => {
        const start = performance.now();
        document.querySelector('.ag-header-cell[col-id="col3"] .ag-header-cell-label').click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return Math.round(performance.now() - start);
    });
    numbers.sort10k = sortMs;
    numbers.pivot10k = await timed("?rows=10000&pivot=1&pivotStart=1");
    numbers.tree10k = await timed("?rows=10000&tree=path&depth=1&grouping=0");
    check("10,000 rows load in under 6 s", numbers.load10k < 6000, `${numbers.load10k} ms`);
    check("10,000 rows sort in under 1.5 s", numbers.sort10k < 1500, `${numbers.sort10k} ms`);
    check("pivot of 10,000 rows opens in under 6 s", numbers.pivot10k < 6000, `${numbers.pivot10k} ms`);
    check("tree of 10,000 rows opens in under 6 s", numbers.tree10k < 6000, `${numbers.tree10k} ms`);

    check("no page errors or AG Grid warnings", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (error) {
    failed++;
    console.log(`FAIL harness crashed - ${error.stack}`);
} finally {
    await browser.close();
}
console.log(`\nnumbers: ${JSON.stringify(numbers)}`);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
