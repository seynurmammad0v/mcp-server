#!/usr/bin/env node
/**
 * Token refresh server for the IcePanel MCP fork.
 *
 * Listens on 127.0.0.1:<port> for POST /token with `{ "token": "<jwt>" }`
 * (or a raw text body) and writes the token to ICEPANEL_BEARER_TOKEN_FILE.
 *
 * Pair with the bookmarklet in bookmarklet/ — clicking it on app.icepanel.io
 * scans storage for the freshest JWT and POSTs it here.
 *
 * Env:
 *   ICEPANEL_BEARER_TOKEN_FILE  — destination file (default: ~/.icepanel/bearer)
 *   PORT                        — bind port (default: 1717)
 *   ALLOWED_ORIGIN              — CORS origin (default: https://app.icepanel.io)
 */

import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";

const TOKEN_FILE = process.env.ICEPANEL_BEARER_TOKEN_FILE || `${homedir()}/.icepanel/bearer`;
const PORT = Number(process.env.PORT || 1717);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://app.icepanel.io";

mkdirSync(dirname(TOKEN_FILE), { recursive: true });

function decodeExp(jwt) {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
    const json = Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const server = createServer((req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "POST" || req.url !== "/token") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("POST /token { token: <jwt> }\n");
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8").trim();
    let token;
    if (raw.startsWith("{")) {
      try { token = JSON.parse(raw).token; } catch { /* fall through */ }
    } else {
      token = raw;
    }
    if (!token || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "no JWT-shaped token in body" }));
      return;
    }
    writeFileSync(TOKEN_FILE, token + "\n", { mode: 0o600 });
    const exp = decodeExp(token);
    const remainingSec = exp ? exp - Math.floor(Date.now() / 1000) : null;
    process.stderr.write(`[${new Date().toISOString()}] wrote ${token.length} chars to ${TOKEN_FILE}; expires in ${remainingSec ?? "?"}s\n`);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, file: TOKEN_FILE, expiresInSec: remainingSec }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stderr.write(`IcePanel token refresh server listening on http://127.0.0.1:${PORT}\n`);
  process.stderr.write(`Token file: ${TOKEN_FILE}\n`);
  process.stderr.write(`Allowed origin: ${ALLOWED_ORIGIN}\n`);
});
