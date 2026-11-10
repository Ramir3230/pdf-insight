import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./index.css";
import "./lib/pdfWorker";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Brak elementu #root w index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
