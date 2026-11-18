import fs from "node:fs";
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

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];
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
        "/api": "http://127.0.0.1:8000",
      },
    },
  };
});
