# Changelog

All notable changes to the AGGrid widget (AG Grid for Mendix) are documented here.

## [1.1.0] - 2026-10-20

The enterprise release: pivot tables, tree data, row grouping, cell ranges with a fill handle and charts, set filters,
a side panel, saved views, detail rows, cell validation, paste from Excel and a styled multi-sheet Excel export. All of
it is built on **AG Grid Community (MIT)**: no AG Grid Enterprise module and no licence key is needed.

Every new property is optional and off by default, so pages built with 1.0.0 look and behave the same after the update
(see [Upgrading](#upgrading-from-100)). Press F4 in Studio Pro after replacing the widget.

### Added - analysis

- **Pivot mode** (Features > Pivot): a Pivot toolbar button and side panel zones for row groups, column labels and
  values; sum, average, count, minimum, maximum and distinct count; subtotal rows, nested column labels, a total column
  per value and a grand total row; follows filters and quick search; sortable and collapsible; kept in the remembered
  layout and saved views; exported as its own Excel sheet. Per column: Pivot start role, Pivot value function, Users can
  pivot on this column; Start in pivot mode.
- **Row grouping** (Features > Grouping): Group by menu with up to three levels, a pinned Group column with chevron,
  value and row count, per-group aggregates aligned with the columns, expand/collapse all, starting grouping per column,
  hide grouped columns, groups start collapsed, On group by change action.
- **Lazy server-side groups** (Server data loading): group by an enumeration or boolean column; group counts per
  request, group rows loaded page by page with a Load more row, filters, search and sort applied to every request.
- **Tree data** (Features > Tree data): Key + Parent key expressions (association paths work) or a Path expression
  with generated levels; tree column with chevron, indentation and descendant counts; keyboard support; expand and
  collapse all; Open levels; filtering keeps the ancestors of matches; Aggregate per parent; hierarchy column and
  outline levels in the exports.
- **Cell range selection** (Features > Range selection): drag, Shift+click and Shift+arrows; Ctrl+C copies the range as
  tab-separated text; Count/Sum/Average of the range in the status bar; a **fill handle** (copy, linear series of
  numbers and dates, "Item 1" counting) and Ctrl+D, one undo step, with an On fill action.
- **Chart range** (toolbar, Alt+F1): built-in SVG bar, line and pie chart with legend, tooltips and a data table for
  screen readers, colour-vision-safe palette for light and dark.
- **Status bar**: shown / total / selected rows and the column aggregates of the selection.
- **Totals rows**: Top and bottom totals rows with separate functions, Distinct count, and *Users can change totals*
  (a menu on a totals cell, kept in views).

### Added - filtering, layout and data entry

- **Set filter** (Filter = Set (checkbox list)): distinct values with search, (Select all) and (Blanks); enumeration and
  boolean captions always listed; sent to the server for enumeration and boolean columns in Server mode.
- **Side panel** (Features > Side panel): Columns tab (search, show/hide, reorder by drag or keyboard, Row groups,
  Column labels and Values zones, Pivot mode switch) and Filters tab (set filter or condition editor per column).
- **Saved views** (Features > Saved views): users save the current layout (column order, widths, visibility, pinning,
  sorting, filters, search text, grouping, pivot) under a name, switch views, rename, delete and star a default view.
  Stored as JSON in a String attribute (per user, across browsers) or in browser storage.
- **Expandable detail rows** (Features > Detail rows): any Mendix widgets in a full-width row under each row; one or
  several rows at a time, fixed or content-fitted height.
- **Cell validation**: a per-column Validation expression; invalid cells get an outline, a red corner and the message
  as tooltip; an "Issues: N" toolbar badge and F8 / Shift+F8 jump to the next invalid cell; optional **Hold commits while
  invalid**.
- **Paste from Excel** (Features > Editing): Ctrl+V writes a copied block into editable cells with per-type conversion,
  one Ctrl+Z undoes the paste, On paste action.
- **Conditional formatting** per number column: data bars, colour scales and icon sets; **Sparkline** render mode.
- **Search highlight**, **Density button** (compact / normal / comfortable), **Motion** setting (full / subtle / off)
  and **Lively effects**: skeleton rows while loading, a refresh progress bar, highlight of rows changed by a refresh,
  an animated empty state with Clear filters. Reduced-motion users get no animations.
- **Keyboard**: keyboard help popover (Shift+?), Ctrl+C / Ctrl+Shift+C copy a cell or a row, Alt+Down / Alt+Up for
  details, / focuses the search box, screen reader announcements.

### Added - export and reliability

- **Styled Excel** (default on): header fill, column widths as shown, frozen header and pinned columns, number and date
  formats, native Excel data bars / colour scales / icon sets and the totals rows as `SUBTOTAL` formulas.
- **Excel sheets** = Data and more (default): extra Pivot and Selection sheets while a pivot or a range is shown;
  grouped exports with Excel outline levels.
- **Reliability**: an error boundary with Retry, a slow-save indicator and a failed-save banner with Retry and Discard
  for inline edits, pastes and fills; right-to-left support.
- New translatable labels for all of the above; other new texts come from AG Grid's locale pack for the session
  language.
- Tests: 133 unit tests (including performance budgets on 10,000 rows and jsdom smoke tests of the whole grid) and two
  browser suites; `npm run sbom` writes a CycloneDX SBOM and `npm run licenses` checks the bundled licences
  (THIRD-PARTY-LICENSES.md).

### Changed

- The Excel export is styled by default and adds Pivot / Selection sheets while a pivot or a range is shown. Set Styled
  Excel = No and Excel sheets = Data only for the plain 1.0.0 file.
- With Lively effects on, a reload of a grid that already shows rows shows a progress bar instead of the loading overlay.
- Grid shortcuts (including undo and redo) no longer fire while typing in the search box or in custom content inputs.
- The column chooser lists columns in their current display order.
- A failed write or commit shows the failed-save banner instead of only a log entry.
- fflate 0.8.3 (security advisory GHSA-px8p-9vwx-vf98 in unzipSync; the widget only zips, but the fixed version ships).

### Fixed

- Pivot mode: with more than eight value columns the pinned Total columns kept a flexible width and squeezed the city
  (column label) columns into a narrow strip; they now have a fixed width.
- Tree data with a Parent key over an association stayed flat when the parent values arrived after the rows.
- Lazy server groups with pagination split an opened group over client pages.
- Toolbar buttons wrap on narrow screens (at 360px the toolbar pushed the page wider).
- Averages without a configured precision are rounded to two decimals.
- Undo/redo of Yes/No columns.

### Upgrading from 1.0.0

- Replace the .mpk and press F4. Existing pages keep their behaviour; the new features are opt-in.
- Only the Excel output changes by default (styled file). Switch Styled Excel off and Excel sheets to Data only to keep
  the 1.0.0 layout.
- Remembered layouts from 1.0.0 load unchanged.

### Known limitations

- Pivot mode, tree data, row grouping and detail rows work with Browser data loading; pivot cells are read-only; at most
  400 generated pivot value columns are shown.
- Lazy server groups: one level, enumeration and boolean columns only, rows inside lazy groups are read-only.
- Set filter with Server data loading only for enumeration and boolean columns (others fall back to a text filter).
- The fill handle fills down or right; charts show up to 8 series.
- Tree data cannot be combined with row grouping, pivot or detail rows.

## [1.0.0] - 2026-09-08

First public release.

### Data

- Data source: database, XPath, association, microflow or nanoflow. Browser data loading (all rows once, optionally capped, refreshed on an interval) or Server data loading (the data source pages, sorts and filters like Data Grid 2, so any number of rows works).
- Columns show an attribute, a dynamic text expression per row or custom content (any widgets per row); attribute columns render as text, link, badge, progress bar or image. Header groups, tooltips, cell class and row class expressions.
- Enumeration, boolean, date and number cells are formatted and edited with the Mendix formatter, captions and editors.

### Interaction

- Sorting on several columns, floating filters (text, number, date, enumeration and boolean) with the Data Grid 2 operator menu in the Atlas theme, quick search (optionally driven by an attribute), pagination with page size choices and automatic page size.
- Inline editing with single or double click, undo and redo, Enter moves down, flashing of changed cells and Mendix validation on the cell. Commit modes: keep in client, commit directly, or run an On commit action that receives the changed object plus the New value, Old value and Attribute name variables.
- Selection (none, single, multi) through the Mendix selection API with checkboxes, select all and select on row click, plus a selection counter with Clear.
- Column pinning, visibility, resizing and reordering, a Columns chooser, auto size strategies, and a remembered layout in browser storage or in a String attribute.
- Row drag with an order attribute that receives the new position.

### Presentation

- Atlas theme that looks like Data Grid 2 (default), or the AG Grid Quartz, Alpine, Balham and Material themes in light, dark or automatic color scheme with accent color, font size and spacing.
- Totals row at the top or bottom with Sum, Average, Minimum, Maximum and Count, or values from a totals data source aggregated on the server.
- Excel (.xlsx with real numbers, dates and booleans, bold frozen header and auto filter) and CSV export of the filtered and sorted rows; in Server mode all matching rows are fetched first.
- Toolbar buttons with inline icons and translatable labels; AG Grid texts follow the Mendix session language for eleven languages.
- Studio Pro preview with Data Grid 2 markup, marketplace icons and tiles, unit tests for the server filters, Excel writer, totals and header groups.
