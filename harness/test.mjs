// Drives the harness in headless Chrome and prints PASS/FAIL per check: node harness/test.mjs
// (build first: node harness/build.mjs). Covers the 1.2 features: grouping, conditional formats, sparklines,
// search highlight, status bar, density, paste from Excel with undo, grouped Excel export, motion levels.
import puppeteer from "puppeteer-core";
import { fileURLToPath, pathToFileURL } from "node:url";

// Any Chromium-based browser works; set CHROME_PATH to use an open-source Chromium build.
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const pageUrl = pathToFileURL(fileURLToPath(new URL("index.html", import.meta.url))).href;

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
    if (ok) {
        passed++;
        console.log(`PASS ${name}`);
    } else {
        failed++;
        console.log(`FAIL ${name}${detail ? ` - ${detail}` : ""}`);
    }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => {
    if (message.type() === "error" || (message.type() === "warning" && /AG Grid/i.test(message.text()))) {
        errors.push(message.text());
    }
});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function open(query = "", width = 1280) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`${pageUrl}${query}`);
    await page.waitForSelector(".ag-row");
    await wait(400);
}

/** Visible rows in display order: "[Label n]" for group rows, the Name for data rows. */
const rowsShown = () =>
    page.evaluate(() => {
        const seen = new Map();
        document.querySelectorAll(".mxt-ag-grid .ag-row[row-index]").forEach(row => {
            const index = Number(row.getAttribute("row-index"));
            if (Number.isNaN(index)) {
                return;
            }
            const entry = seen.get(index) ?? { index };
            const group = row.querySelector(".mxt-ag-group");
            if (group) {
                entry.text = `[${group.querySelector(".mxt-ag-group__label").textContent} ${
                    group.querySelector(".mxt-ag-group__count").textContent
                }]`;
            }
            const name = row.querySelector('[col-id="col0"]');
            if (name && !entry.text) {
                entry.text = name.textContent;
            }
            seen.set(index, entry);
        });
        return [...seen.values()].sort((a, b) => a.index - b.index).map(entry => entry.text);
    });
const groups = async () => (await rowsShown()).filter(text => text?.startsWith("["));
const events = name => page.evaluate(n => window.harness.events.filter(e => e.name === n), name);
const cellText = (rowName, colId) =>
    page.evaluate(
        (name, col) => {
            const row = [...document.querySelectorAll(".ag-row")].find(
                r => r.querySelector('[col-id="col0"]')?.textContent === name
            );
            const index = row?.getAttribute("row-index");
            return document.querySelector(`.ag-row[row-index="${index}"] [col-id="${col}"]`)?.textContent;
        },
        rowName,
        colId
    );
const clickGroupToggle = label =>
    page.evaluate(text => {
        const group = [...document.querySelectorAll(".mxt-ag-group")].find(
            g => g.querySelector(".mxt-ag-group__label").textContent === text
        );
        group.querySelector(".mxt-ag-group__toggle").click();
    }, label);
async function openGroupMenu() {
    await page.click(".mxt-ag-groupby > button");
    await page.waitForSelector(".mxt-ag-groupby__menu");
}
async function menuItem(text) {
    const handles = await page.$$(".mxt-ag-groupby__menu [data-menuitem]");
    for (const handle of handles) {
        if ((await handle.evaluate(el => el.textContent)).includes(text)) {
            return handle;
        }
    }
    return undefined;
}
async function focusCell(rowName, colId) {
    const index = await page.evaluate(name => {
        const row = [...document.querySelectorAll(".ag-row")].find(
            r => r.querySelector('[col-id="col0"]')?.textContent === name
        );
        return row.getAttribute("row-index");
    }, rowName);
    // A real click, so AG Grid registers the focused cell.
    await page.click(`.ag-row[row-index="${index}"] [col-id="${colId}"]`);
    await wait(80);
}
const paste = text =>
    page.evaluate(value => {
        const data = new DataTransfer();
        data.setData("text/plain", value);
        document.activeElement.dispatchEvent(
            new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
        );
    }, text);

try {
    // ---- 1. Row grouping ------------------------------------------------------------------------
    await open("?group=dept&auto=1");
    let shown = await rowsShown();
    check(
        "configured Group by level groups by Department in sorted order with counts",
        JSON.stringify(await groups()) === JSON.stringify(["[Finance 7]", "[IT 8]", "[Sales 8]", "[Support 7]"]),
        JSON.stringify(await groups())
    );
    check("all 30 data rows shown under their groups", shown.length === 34, String(shown.length));
    check(
        "rows follow their group header",
        shown[1]?.startsWith("Cid 3") && shown[0] === "[Finance 7]",
        shown.slice(0, 3).join()
    );
    check(
        "group column header uses the label",
        (await page.$eval('.ag-header-cell[col-id="__mxt_group__"]', el => el.textContent)).includes("Group")
    );
    const itSalary = await page.evaluate(() => {
        const row = [...document.querySelectorAll(".ag-row.mxt-ag-row-group")].find(r => r.textContent.includes("IT"));
        const index = row.getAttribute("row-index");
        return document.querySelector(`.ag-row[row-index="${index}"] [col-id="col3"]`)?.textContent;
    });
    check("group row shows the column aggregate (sum of salaries)", itSalary === "20000", itSalary);
    check(
        "group rows have no selection checkbox and cannot be selected",
        await page.evaluate(() => {
            const box = document.querySelector(".ag-row.mxt-ag-row-group .ag-selection-checkbox");
            return !box || getComputedStyle(box).visibility === "hidden";
        })
    );

    await clickGroupToggle("IT");
    await wait(250);
    shown = await rowsShown();
    check("collapsing a group hides its rows", shown.length === 26 && shown.includes("[IT 8]"), String(shown.length));
    check(
        "collapsed toggle reports aria-expanded=false",
        await page.evaluate(() =>
            [...document.querySelectorAll(".mxt-ag-group")].some(
                g => g.textContent.includes("IT") && g.querySelector("button").getAttribute("aria-expanded") === "false"
            )
        )
    );
    // Keyboard: focus the group cell of IT and press Enter.
    const itIndex = await page.evaluate(() =>
        [...document.querySelectorAll(".ag-row.mxt-ag-row-group")]
            .find(r => r.textContent.includes("IT"))
            .getAttribute("row-index")
    );
    await page.click(`.ag-row[row-index="${itIndex}"] [col-id="__mxt_group__"] .mxt-ag-group__label`);
    await page.keyboard.press("Enter");
    await wait(250);
    check("Enter on the group cell expands it again", (await rowsShown()).length === 34);
    await page.keyboard.press("ArrowLeft");
    await wait(250);
    check("ArrowLeft on the group cell collapses it", (await rowsShown()).length === 26);
    await page.keyboard.press("ArrowRight");
    await wait(250);

    // Sorting the grouped column descending reverses the groups.
    await page.click('.ag-header-cell[col-id="col1"] .ag-header-cell-label');
    await wait(150);
    await page.click('.ag-header-cell[col-id="col1"] .ag-header-cell-label');
    await wait(250);
    check(
        "a descending sort on the grouped column reverses the group order",
        (await groups())[0] === "[Support 7]",
        JSON.stringify(await groups())
    );
    await page.click('.ag-header-cell[col-id="col1"] .ag-header-cell-label');
    await wait(200);

    // Group by menu: add City as level 2.
    await openGroupMenu();
    await (await menuItem("City")).click();
    await wait(300);
    const nested = await page.$$eval(".ag-row.mxt-ag-row-group--level-1", rows => rows.length);
    check("Group by menu adds a second level (nested City groups)", nested > 0, String(nested));
    const groupEvents = await events("onGroupByChange");
    check(
        "On group by change runs with the grouped captions",
        groupEvents.at(-1)?.args?.groupBy === "Department > City",
        JSON.stringify(groupEvents.at(-1))
    );
    check(
        "toolbar chip shows the grouping",
        (await page.$eval(".mxt-ag-groupby__chips", el => el.textContent)).includes("City")
    );
    // Move City up to level 1.
    const moveUp = await page.$('.mxt-ag-groupby__menu [aria-label="Move City up"]');
    await moveUp.click();
    await wait(300);
    check(
        "moving a level reorders the grouping",
        (await groups())[0] === "[Oslo 10]",
        JSON.stringify((await groups()).slice(0, 2))
    );
    await page.click(".mxt-ag-groupby > button");
    await wait(100);

    // Quick search filters the groups and recounts them.
    await page.type(".mxt-ag-toolbar__search", "Finance");
    await wait(500);
    const filteredGroups = await groups();
    check(
        "quick search recounts groups and drops empty ones",
        filteredGroups.includes("[Oslo 2]") &&
            !filteredGroups.some(g => g.startsWith("[IT")) &&
            filteredGroups.includes("[Finance 2]"),
        JSON.stringify(filteredGroups)
    );
    const highlights = await page.evaluate(() => CSS.highlights?.get("mxt-ag-search")?.size ?? -1);
    check("search matches are highlighted with the CSS Highlight API", highlights > 0, String(highlights));
    check(
        "status bar counts the shown rows",
        (await page.$eval(".mxt-ag-status__rows", el => el.textContent)).includes("7 of 30"),
        await page.$eval(".mxt-ag-status__rows", el => el.textContent)
    );
    await page.click(".mxt-ag-toolbar__search", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await wait(500);
    check(
        "clearing the search removes the highlights",
        await page.evaluate(() => !CSS.highlights?.get("mxt-ag-search"))
    );

    // Collapse all / expand all / ungroup.
    await openGroupMenu();
    await (await menuItem("Collapse all")).click();
    await wait(300);
    shown = await rowsShown();
    check(
        "Collapse all leaves only the top-level groups",
        shown.every(text => text.startsWith("[")) && shown.length === 3,
        JSON.stringify(shown)
    );
    await (await menuItem("Expand all")).click();
    await wait(300);
    check("Expand all shows every row again", (await rowsShown()).length > 30);

    // Grouped Excel export: outline levels and bold group rows.
    await page.keyboard.press("Escape");
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-toolbar__buttons .btn")]
            .find(b => b.textContent.includes("Export Excel"))
            .click()
    );
    await wait(600);
    const xlsx = await page.evaluate(() => window.harness.downloads.find(d => d.name.endsWith(".xlsx"))?.text ?? "");
    check(
        "grouped Excel export writes outline levels",
        xlsx.includes('outlineLevel="2"') && xlsx.includes("outlinePr"),
        xlsx.slice(0, 120)
    );
    check(
        "grouped Excel export contains all 30 rows plus group headers",
        (xlsx.match(/<row /g) ?? []).length > 31,
        String((xlsx.match(/<row /g) ?? []).length)
    );
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-toolbar__buttons .btn")]
            .find(b => b.textContent.includes("Export CSV"))
            .click()
    );
    await wait(600);
    const csv = await page.evaluate(() => window.harness.downloads.find(d => d.name.endsWith(".csv"))?.text ?? "");
    check(
        "CSV export while grouped holds only the 30 data rows",
        csv.trim().split(/\r\n/).length === 31,
        String(csv.trim().split(/\r\n/).length)
    );

    await openGroupMenu();
    await (await menuItem("Ungroup")).click();
    await wait(300);
    check(
        "Ungroup removes the group rows and column",
        (await groups()).length === 0 && !(await page.$('.ag-header-cell[col-id="__mxt_group__"]'))
    );
    check(
        "On group by change reports the empty grouping",
        (await events("onGroupByChange")).at(-1)?.args?.groupBy === ""
    );

    // ---- 2. Conditional formats and sparklines ---------------------------------------------------
    await open("?auto=1");
    const bar = await page.$eval('.ag-row[row-index="29"] [col-id="col3"]', el => el.style.backgroundImage);
    check("data bar fills the highest salary completely", bar.includes("100%, transparent 100%"), bar);
    const icons = await page.$$eval('[col-id="col4"].mxt-ag-cf-icon', cells =>
        cells.map(c => c.className.match(/--(up|flat|down)/)?.[1])
    );
    check(
        "icon set marks high, middle and low ratings",
        ["up", "flat", "down"].every(kind => icons.includes(kind)),
        icons.join()
    );
    const arrow = await page.$eval(
        '[col-id="col4"].mxt-ag-cf-icon--up',
        el => getComputedStyle(el, "::before").content
    );
    check("icon set draws an arrow before the value", arrow.includes("▲"), arrow);
    const spark = await page.$eval('.ag-row[row-index="3"] [col-id="col7"] svg.mxt-ag-spark', el => ({
        points: el.querySelector("polyline").getAttribute("points").split(" ").length,
        label: el.getAttribute("aria-label")
    }));
    check(
        "sparkline cell draws the series with an accessible label",
        spark.points === 5 && /Trend/.test(spark.label),
        JSON.stringify(spark)
    );

    // ---- 3. Status bar with selection -------------------------------------------------------------
    check(
        "status bar shows all rows and the column aggregates",
        (await page.$eval(".mxt-ag-status", el => el.textContent)).includes("30 of 30 rows") &&
            (await page.$eval(".mxt-ag-status", el => el.textContent)).includes("Sum Salary73500"),
        await page.$eval(".mxt-ag-status", el => el.textContent)
    );
    await page.click('.ag-row[row-index="0"] .ag-selection-checkbox input');
    await page.click('.ag-row[row-index="1"] .ag-selection-checkbox input');
    await wait(700);
    const status = await page.$eval(".mxt-ag-status", el => el.textContent);
    check(
        "status bar aggregates the selected rows",
        status.includes("2 selected") && status.includes("Sum Salary2100"),
        status
    );

    // ---- 4. Density -----------------------------------------------------------------------------------
    const heightBefore = await page.$eval('.ag-row[row-index="0"]', el => el.getBoundingClientRect().height);
    await page.click(".mxt-ag-density");
    await wait(300);
    const heightComfortable = await page.$eval('.ag-row[row-index="0"]', el => el.getBoundingClientRect().height);
    await page.click(".mxt-ag-density");
    await wait(300);
    const heightCompact = await page.$eval('.ag-row[row-index="0"]', el => el.getBoundingClientRect().height);
    check(
        "density button cycles comfortable and compact rows",
        heightComfortable > heightBefore && heightCompact < heightBefore,
        `${heightBefore} ${heightComfortable} ${heightCompact}`
    );

    // ---- 5. Paste from Excel ----------------------------------------------------------------------------
    await open("?auto=1&density=0");
    await focusCell("Ann 1", "col3");
    await paste("111\t5\r\n222\tx\r\n");
    await wait(300);
    check(
        "paste writes a block down and to the right",
        (await page.evaluate(() =>
            [
                window.harness.value("e1", "salary"),
                window.harness.value("e1", "rating"),
                window.harness.value("e2", "salary")
            ].join()
        )) === "111,5,222"
    );
    check(
        "paste skips values that do not fit the column",
        (await page.evaluate(() => window.harness.value("e2", "rating"))) === "7"
    );
    check(
        "On paste runs once with the number of changed cells",
        JSON.stringify((await events("onPaste")).map(e => e.args.cellCount)) === "[3]",
        JSON.stringify(await events("onPaste"))
    );
    check(
        "the grid shows the pasted values",
        (await cellText("Ann 1", "col3")) === "111",
        await cellText("Ann 1", "col3")
    );
    await page.keyboard.down("Control");
    await page.keyboard.press("z");
    await page.keyboard.up("Control");
    await wait(300);
    check(
        "one Ctrl+Z undoes the whole paste",
        (await page.evaluate(() =>
            [
                window.harness.value("e1", "salary"),
                window.harness.value("e1", "rating"),
                window.harness.value("e2", "salary")
            ].join()
        )) === "1000,0,1100"
    );
    await page.keyboard.down("Control");
    await page.keyboard.press("y");
    await page.keyboard.up("Control");
    await wait(300);
    check("Ctrl+Y redoes the paste", (await page.evaluate(() => window.harness.value("e2", "salary"))) === "222");
    await focusCell("Cid 3", "col5");
    await paste("no");
    await wait(200);
    check(
        "paste converts Yes/No text for boolean columns",
        (await page.evaluate(() => window.harness.value("e3", "active"))) === "No"
    );
    await page.keyboard.down("Control");
    await page.keyboard.press("z");
    await page.keyboard.up("Control");
    await wait(300);
    check(
        "Ctrl+Z restores a pasted boolean",
        (await page.evaluate(() => window.harness.value("e3", "active"))) === "Yes"
    );
    await focusCell("Cid 3", "col6");
    await paste("2026-10-09");
    await wait(200);
    check(
        "read-only columns are not pasted into",
        (await page.evaluate(() => window.harness.value("e3", "hired"))) !== "2026-10-09"
    );

    // ---- 6. Persistence of grouping and density -----------------------------------------------------
    await page.evaluate(() => localStorage.clear());
    await open("?store=1&auto=1");
    await openGroupMenu();
    await (await menuItem("City")).click();
    await wait(300);
    await page.click(".mxt-ag-groupby > button");
    await page.click(".mxt-ag-density");
    await wait(600);
    await open("?store=1&auto=1");
    await wait(300);
    check(
        "grouping is restored from the remembered layout",
        (await groups()).length === 3,
        JSON.stringify(await groups())
    );
    check(
        "density is restored from the remembered layout",
        await page.$eval(".mxt-ag-density", el => el.dataset.density === "comfortable")
    );
    await page.evaluate(() =>
        [...document.querySelectorAll(".mxt-ag-toolbar__buttons .btn")]
            .find(b => b.textContent.includes("Reset"))
            .click()
    );
    await wait(300);
    check(
        "Reset ungroups and restores the normal density",
        (await groups()).length === 0 && (await page.$eval(".mxt-ag-density", el => el.dataset.density)) === "normal"
    );
    await page.evaluate(() => localStorage.clear());

    // ---- 7. Motion levels, collapsed start, hidden grouped columns, server mode -------------------------
    await open("?motion=off");
    check("Motion off removes the animation class", !(await page.$(".mxt-ag-grid--animate")));
    await open("?motion=subtle");
    check("Motion subtle keeps fades only", Boolean(await page.$(".mxt-ag-grid--animate.mxt-ag-grid--subtle")));
    await open("?group=dept&collapsed=1&hide=1&auto=1");
    shown = await rowsShown();
    check("Groups start expanded = No starts collapsed", shown.length === 4, JSON.stringify(shown));
    check("Hide grouped columns hides Department", !(await page.$('.ag-header-cell[col-id="col1"]')));
    await open("?server=1&group=dept");
    check("server mode offers no grouping", !(await page.$(".mxt-ag-groupby")) && (await groups()).length === 0);

    // ---- 8. Mobile width and dark mode ----------------------------------------------------------------------
    await open("?group=dept&dark=1", 360);
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check("no page overflow at 360px", overflow <= 0, String(overflow));

    check("no page errors or AG Grid warnings", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (error) {
    failed++;
    console.log(`FAIL harness crashed - ${error.stack}`);
} finally {
    await browser.close();
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
