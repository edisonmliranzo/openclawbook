import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './firebase'
import App from './App'

console.log("Starting OpenClaw Book Application...");

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#f4212e', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h1>Render Error</h1>
          <h3>{this.state.error?.message}</h3>
          <p>{this.state.error?.stack}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Root element not found!");
} else {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
