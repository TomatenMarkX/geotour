import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { AuthProvider } from "@/auth/AuthProvider";
import App from "@/App";
import AuthCallback from "@/pages/AuthCallback";
import PublicTourPage from "@/pages/PublicTourPage";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root-Element nicht gefunden");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/tour/:shareToken" element={<PublicTourPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
