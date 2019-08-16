import React from 'react'

export class ErrorBoundary extends React.Component {
  public readonly state: {
    error?: string
  } = {}

  public static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }

  public render() {
    if (this.state.error) {
      return <div className={'error message'}>{this.state.error}</div>
    }

    return this.props.children
  }
}
