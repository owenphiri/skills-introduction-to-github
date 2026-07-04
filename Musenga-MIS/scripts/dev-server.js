#!/usr/bin/env node
// Local dev server: serves public/ over plain HTTP on localhost so the app
// can be opened at a real http:// origin (service worker / IndexedDB behave
// differently under file://). Host/port are env-driven so this never
// hardcodes a domain — see .env.example.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.HOST || "localhost";
const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer((req, res) => {
  const reqPath = decodeURIComponent(req.url.split("?")[0]);
  const rel = reqPath === "/" ? "/index.html" : reqPath;
  const filePath = path.normalize(path.join(ROOT, rel));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + rel);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Musenga MIS dev server: http://${HOST}:${PORT}`);
});
