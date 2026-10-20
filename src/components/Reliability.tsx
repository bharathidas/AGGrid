import { Component, ErrorInfo, ReactElement, ReactNode } from "react";

import { CommitSnapshot, failedText } from "../utils/commitTracker";
import { WarningIcon } from "./Icons";

export interface CommitBannerProps {
    snapshot: CommitSnapshot;
    failedTemplate: string;
    retryLabel: string;
    discardLabel: string;
    savingLabel: string;
    onRetry: () => void;
    onDiscard: () => void;
}

/** Shows slow saves ("Saving...") and failed saves with Retry and Discard, so no change is lost silently. */
export function CommitBanner(props: CommitBannerProps): ReactElement | null {
    const { snapshot } = props;
    const failed = snapshot.failed.length;
    if (failed === 0 && snapshot.slow === 0) {
        return null;
    }
    if (failed === 0) {
        return (
            <div className="mxt-ag-commit mxt-ag-commit--slow" role="status">
                <span className="mxt-ag-commit__spinner" aria-hidden="true" />
                <span>{props.savingLabel}</span>
            </div>
        );
    }
    const details = snapshot.failed
        .slice(0, 3)
        .map(entry => entry.message)
        .filter((message, index, list) => list.indexOf(message) === index)
        .join("; ");
    return (
        <div className="mxt-ag-commit mxt-ag-commit--failed" role="alert">
            <WarningIcon />
            <span className="mxt-ag-commit__text">
                {failedText(props.failedTemplate, failed)}
                {details && <span className="mxt-ag-commit__detail"> {details}</span>}
            </span>
            <button type="button" className="btn btn-default btn-sm mxt-ag-commit__retry" onClick={props.onRetry}>
                {props.retryLabel}
            </button>
            <button type="button" className="btn btn-link btn-sm mxt-ag-commit__discard" onClick={props.onDiscard}>
                {props.discardLabel}
            </button>
        </div>
    );
}

export interface ErrorBoundaryProps {
    message: string;
    retryLabel: string;
    children: ReactNode;
}

interface ErrorBoundaryState {
    error?: Error;
    attempt: number;
}

/** Catches a render error of the grid and offers to draw it again instead of breaking the whole page. */
export class GridErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { attempt: 0 };

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error("AGGrid: the grid stopped after an error", error, info.componentStack);
    }

    private retry = (): void => {
        this.setState(state => ({ error: undefined, attempt: state.attempt + 1 }));
    };

    render(): ReactNode {
        if (this.state.error) {
            return (
                <div className="mxt-ag-crash" role="alert">
                    <WarningIcon />
                    <span className="mxt-ag-crash__text">{this.props.message}</span>
                    <span className="mxt-ag-crash__detail">{this.state.error.message}</span>
                    <button type="button" className="btn btn-default mxt-ag-crash__retry" onClick={this.retry}>
                        {this.props.retryLabel}
                    </button>
                </div>
            );
        }
        // A new key after "Retry" mounts a fresh grid.
        return <ErrorBoundaryChild key={this.state.attempt}>{this.props.children}</ErrorBoundaryChild>;
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { error };
    }
}

function ErrorBoundaryChild(props: { children: ReactNode }): ReactElement {
    return <>{props.children}</>;
}
