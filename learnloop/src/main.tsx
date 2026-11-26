import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import ServerWaking from "./components/ServerWaking";
import { warmUp } from "./lib/api";
import { AuthProvider } from "./lib/auth";
import "./index.css";

warmUp(); // wake a sleeping free-tier API while the visitor reads the first screen

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
        <ServerWaking />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>,
);
