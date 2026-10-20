/**
 * Keeps track of saves (writes and commits through the Mendix client API) so that a slow or failed save is never
 * lost silently: failed saves stay listed until the user retries or discards (rolls back) them.
 */

export interface CommitHandle {
    done(): void;
    failed(error: unknown, retry: () => void): void;
}

export interface CommitMonitor {
    start(): CommitHandle;
}

export interface FailedCommit {
    key: number;
    rowId: string;
    colId: string;
    oldValue: unknown;
    newValue: unknown;
    message: string;
    retry: () => void;
}

export interface CommitSnapshot {
    /** Saves still running. */
    pending: number;
    /** Running saves older than the slow threshold. */
    slow: number;
    failed: FailedCommit[];
}

export interface CommitInfo {
    rowId: string;
    colId: string;
    oldValue: unknown;
    newValue: unknown;
}

export const SLOW_COMMIT_MS = 4000;

export function errorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "Unknown error";
}

export class CommitTracker {
    private counter = 0;
    private readonly running = new Map<number, number>();
    private readonly failures = new Map<number, FailedCommit>();
    private readonly listeners = new Set<() => void>();

    constructor(private readonly now: () => number = () => Date.now(), private readonly slowMs = SLOW_COMMIT_MS) {}

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(): void {
        this.listeners.forEach(listener => listener());
    }

    /** A monitor for one cell write; failures replace an earlier failure of the same cell. */
    monitor(info: CommitInfo): CommitMonitor {
        return {
            start: () => {
                const key = ++this.counter;
                this.running.set(key, this.now());
                this.emit();
                let finished = false;
                return {
                    done: () => {
                        if (finished) {
                            return;
                        }
                        finished = true;
                        this.running.delete(key);
                        this.clearCell(info.rowId, info.colId);
                        this.emit();
                    },
                    failed: (error, retry) => {
                        if (finished) {
                            return;
                        }
                        finished = true;
                        this.running.delete(key);
                        this.clearCell(info.rowId, info.colId);
                        this.failures.set(key, { key, ...info, message: errorMessage(error), retry });
                        this.emit();
                    }
                };
            }
        };
    }

    private clearCell(rowId: string, colId: string): void {
        this.failures.forEach((failure, key) => {
            if (failure.rowId === rowId && failure.colId === colId) {
                this.failures.delete(key);
            }
        });
    }

    snapshot(): CommitSnapshot {
        const now = this.now();
        let slow = 0;
        this.running.forEach(started => {
            if (now - started >= this.slowMs) {
                slow++;
            }
        });
        return { pending: this.running.size, slow, failed: Array.from(this.failures.values()) };
    }

    /** Retries every failed save (each retry reports its own outcome again). */
    retryAll(): void {
        const list = Array.from(this.failures.values());
        this.failures.clear();
        this.emit();
        list.forEach(failure => failure.retry());
    }

    /** Forgets the failed saves after the caller rolled them back; returns them, newest last. */
    discardAll(): FailedCommit[] {
        const list = Array.from(this.failures.values()).sort((a, b) => a.key - b.key);
        this.failures.clear();
        this.emit();
        return list;
    }

    hasWork(): boolean {
        return this.running.size > 0 || this.failures.size > 0;
    }
}

/** Banner text: "[count] change(s) could not be saved." with the count filled in. */
export function failedText(template: string, count: number): string {
    return template.replace(/\[count\]/g, String(count));
}
