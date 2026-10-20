import type { ListValue, ObjectItem } from "mendix";
import type { FilterCondition } from "mendix/filters";

/**
 * Serializes several reads through the one Mendix list data source a pluggable widget gets: each request sets
 * filter, sort order, offset and limit, and is answered once the data source holds exactly that page. Used by
 * the lazy server groups (group counts and group pages).
 */

export interface DatasourceRequest<T> {
    filter: FilterCondition | undefined;
    sortOrder: ListValue["sortOrder"];
    offset: number;
    limit: number;
    /** Runs synchronously while the data source holds the page (values are read right away). */
    build: (items: ObjectItem[], totalCount: number | undefined) => T;
}

interface Entry<T> {
    request: DatasourceRequest<T>;
    filterKey: string;
    sortKey: string;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timer?: ReturnType<typeof setTimeout>;
}

export const REQUEST_TIMEOUT_MS = 20000;

export class DatasourceQueue {
    private readonly entries: Array<Entry<unknown>> = [];
    private current: Entry<unknown> | undefined;

    constructor(private readonly datasource: () => ListValue, private readonly timeoutMs = REQUEST_TIMEOUT_MS) {}

    get busy(): boolean {
        return Boolean(this.current) || this.entries.length > 0;
    }

    request<T>(request: DatasourceRequest<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.entries.push({
                request,
                filterKey: JSON.stringify(request.filter ?? null),
                sortKey: JSON.stringify(request.sortOrder ?? []),
                resolve,
                reject
            } as Entry<unknown>);
            this.pump();
        });
    }

    /** Call whenever the data source may have changed (every render). */
    pump(): void {
        // A loop: pages the data source already holds are answered at once.
        for (let guard = 0; guard < 1000; guard++) {
            if (!this.current) {
                const next = this.entries.shift();
                if (!next) {
                    return;
                }
                this.start(next);
            }
            if (!this.tryResolve()) {
                return;
            }
        }
    }

    private start(entry: Entry<unknown>): void {
        this.current = entry;
        const ds = this.datasource();
        const { request } = entry;
        entry.timer = setTimeout(() => {
            if (this.current === entry) {
                this.current = undefined;
                entry.reject(new Error("the data source did not answer in time"));
                this.pump();
            }
        }, this.timeoutMs);
        ds.setSortOrder(request.sortOrder);
        ds.setFilter(request.filter);
        ds.setOffset(request.offset);
        ds.setLimit(request.limit);
        ds.requestTotalCount(true);
    }

    private tryResolve(): boolean {
        const entry = this.current;
        const ds = this.datasource();
        if (!entry || ds.status !== "available") {
            return false;
        }
        const matches =
            ds.offset === entry.request.offset &&
            ds.limit === entry.request.limit &&
            JSON.stringify(ds.sortOrder ?? []) === entry.sortKey &&
            JSON.stringify(ds.filter ?? null) === entry.filterKey;
        if (!matches) {
            return false;
        }
        clearTimeout(entry.timer);
        this.current = undefined;
        try {
            entry.resolve(entry.request.build(ds.items ?? [], ds.totalCount));
        } catch (error) {
            entry.reject(error instanceof Error ? error : new Error(String(error)));
        }
        return true;
    }

    /** Drops every waiting request (for example after the filters changed). */
    cancelAll(): void {
        const all = [...(this.current ? [this.current] : []), ...this.entries.splice(0)];
        this.current = undefined;
        all.forEach(entry => {
            clearTimeout(entry.timer);
            entry.reject(new Error("cancelled"));
        });
    }
}
