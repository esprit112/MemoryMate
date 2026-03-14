import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
          <h2>Something went wrong.</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre style={{ fontSize: '0.8em', marginTop: '1rem' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

if (!PUBLISHABLE_KEY) {
  root.render(
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>Missing Clerk Publishable Key</h2>
      <p>Please add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to your environment variables in the Settings menu.</p>
    </div>
  );
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
          <App />
        </ClerkProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
