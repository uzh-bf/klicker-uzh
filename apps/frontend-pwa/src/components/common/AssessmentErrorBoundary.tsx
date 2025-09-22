import { Component, ErrorInfo, ReactNode } from 'react'

type FallbackRender = (options: {
  error: Error | null
  reset: () => void
}) => ReactNode

type AssessmentErrorBoundaryProps = {
  children: ReactNode
  fallback: FallbackRender
  onError?: (error: Error, info: ErrorInfo) => void
}

type AssessmentErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export default class AssessmentErrorBoundary extends Component<
  AssessmentErrorBoundaryProps,
  AssessmentErrorBoundaryState
> {
  state: AssessmentErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): AssessmentErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError) {
      this.props.onError(error, info)
    }
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback({ error: this.state.error, reset: this.reset })
    }

    return this.props.children
  }
}
