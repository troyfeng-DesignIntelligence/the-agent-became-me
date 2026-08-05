import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/source-serif-4/opsz-italic.css";
import "@fontsource-variable/syne";
import "@fontsource/ibm-plex-mono/400.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { OnlineStorefront } from "./online-storefront/OnlineStorefront";
import "./styles.css";
import "./art-direction.css";

const root = document.getElementById("root");
const isStorefront = new URLSearchParams(window.location.search).get("view") === "storefront";

if (!root) {
  throw new Error("Missing #root element.");
}

createRoot(root).render(
  <StrictMode>
    {isStorefront ? <OnlineStorefront /> : <App />}
  </StrictMode>
);
