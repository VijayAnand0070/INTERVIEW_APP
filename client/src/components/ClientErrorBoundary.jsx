import React from "react";

export default class ClientErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Client render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
          <div className="mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-5">
            <p className="text-sm font-semibold text-red-200">The interview screen hit a browser error.</p>
            <p className="mt-2 text-sm text-slate-300">
              Refresh the page once. Your session is saved, so it will return to the current question.
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-black/30 p-3 text-xs text-red-100">
              {this.state.error?.message || String(this.state.error)}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
