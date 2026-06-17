import { Component } from 'react'

export class ChartErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('[ChartErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-400"
          style={{ height: this.props.height ?? 200 }}>
          Grafico non disponibile
        </div>
      )
    }
    return this.props.children
  }
}

export default class ErrorBoundary extends Component {
  state = { hasError: false, message: '' }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? 'Errore sconosciuto' }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-xl border border-red-200 shadow-sm p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">
              Qualcosa è andato storto
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Si è verificato un errore imprevisto. Ricarica la pagina per riprendere.
            </p>
            <p className="text-xs text-red-400 font-mono bg-red-50 rounded p-2 mb-6 text-left break-all">
              {this.state.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-granata text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-granata-dark transition-colors"
            >
              Ricarica la pagina
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
