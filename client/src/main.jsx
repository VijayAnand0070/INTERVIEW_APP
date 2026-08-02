import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import ClientErrorBoundary from "./components/ClientErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClientErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ClientErrorBoundary>
  </React.StrictMode>
);
