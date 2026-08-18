import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
} catch (e) {
  // Never leave a blank page — the watchdog in index.html takes over.
  const fb = document.getElementById("boot-fallback");
  const detail = document.getElementById("boot-detail");
  if (fb && detail) {
    detail.textContent = String((e as Error)?.message ?? e);
    fb.style.display = "block";
  } else {
    throw e;
  }
}
