import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./design/theme.css";
import { finishLogin, loadConfig } from "./spotify.js";

// O login do Spotify exige 127.0.0.1; quem abrir por "localhost" é redirecionado.
if (window.location.hostname === "localhost") {
  window.location.replace(window.location.href.replace("//localhost", "//127.0.0.1"));
} else {
  // Se estamos voltando do login do Spotify, conclui a conexão antes de abrir o app.
  loadConfig()
    .then(finishLogin)
    .finally(() => {
      ReactDOM.createRoot(document.getElementById("root")).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });
}
