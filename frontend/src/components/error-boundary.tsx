import { Component, type ReactNode, type ErrorInfo } from "react";
import { resolveError, type AppError } from "@/lib/errors";
import { ErrorScreen } from "@/components/error-screen";

interface Props {
  children: ReactNode;
}

interface State {
  error: AppError | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(err: Error) {
    return { error: resolveError(err) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${resolveError(error).code}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
