import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// HTTPS no servidor de desenvolvimento.
// - Se existirem certificados em frontend/certs/ (gerados com o mkcert ou o
//   openssl, veja o README), eles são usados.
// - Se não existirem, o plugin basic-ssl gera um certificado na hora.
const certFile = fileURLToPath(new URL("./certs/cert.pem", import.meta.url));
const keyFile = fileURLToPath(new URL("./certs/key.pem", import.meta.url));
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile);

const API_PORT = 8000;
const rootDir = fileURLToPath(new URL("..", import.meta.url));

// Python do .venv da pasta principal (Windows ou macOS/Linux); sem .venv,
// usa o Python do sistema.
function pythonPath() {
  const candidates =
    process.platform === "win32"
      ? [".venv/Scripts/python.exe", "venv/Scripts/python.exe"]
      : [".venv/bin/python", "venv/bin/python"];
  for (const rel of candidates) {
    const full = path.join(rootDir, rel);
    if (fs.existsSync(full)) return full;
  }
  return process.platform === "win32" ? "python" : "python3";
}

async function apiIsUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${API_PORT}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// Com `npm run dev`, liga a API (FastAPI) junto com o site e a desliga
// quando o site para. Se a API já estiver no ar (pelo dev.sh, por exemplo),
// não liga outra.
function apiServer() {
  return {
    name: "echotrack-api",
    apply: "serve",
    async configureServer() {
      if (await apiIsUp()) return;

      const api = spawn(
        pythonPath(),
        [
          "-m", "uvicorn", "app.main:app",
          "--reload", "--reload-dir", "app", "--reload-dir", "src",
          "--port", String(API_PORT), "--log-level", "warning",
        ],
        { cwd: rootDir, stdio: "inherit" },
      );
      api.on("error", (err) => {
        console.error(`\nNão deu para ligar a API: ${err.message}`);
      });

      let stopped = false;
      const stop = () => {
        if (stopped || api.exitCode !== null) return;
        stopped = true;
        if (process.platform === "win32") {
          // O --reload abre um processo filho; o /T derruba os dois.
          spawnSync("taskkill", ["/pid", String(api.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          api.kill();
        }
      };
      process.on("exit", stop);
      for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
        process.once(sig, () => {
          stop();
          process.exit();
        });
      }
    },
  };
}

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss(), apiServer()];
  if (!hasCerts) {
    const { default: basicSsl } = await import("@vitejs/plugin-basic-ssl");
    plugins.push(basicSsl());
  }

  return {
    plugins,
    server: {
      // O login do Spotify só aceita 127.0.0.1 (não "localhost").
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      https: hasCerts
        ? { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) }
        : undefined,
      // O proxy repassa /api para o FastAPI, então o front não precisa
      // saber a porta da API nem depender de CORS.
      proxy: {
        "/api": `http://127.0.0.1:${API_PORT}`,
      },
    },
  };
});
