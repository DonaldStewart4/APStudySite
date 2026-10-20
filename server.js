// Local development server: serves the static site and runs the /api
// handlers the same way Vercel does. Zero dependencies beyond the SDK.
//
//   npm run dev        # real lessons (needs ANTHROPIC_API_KEY in .env)
//   npm run dev:mock   # offline demo lessons

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const routes = {
  "/api/lesson": () => import("./api/lesson.js"),
  "/api/explain": () => import("./api/explain.js"),
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

// Only these folders (and index.html) are public; api/, node_modules/, .env stay private.
const PUBLIC = ["css/", "js/", "data/", "assets/"];

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error("Body too large");
    chunks.push(c);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (routes[url.pathname]) {
    try {
      req.body = await readJson(req);
    } catch {
      res.writeHead(400).end("Bad JSON");
      return;
    }
    const { default: handler } = await routes[url.pathname]();
    return handler(req, res);
  }

  let path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (path === "") path = "index.html";
  path = normalize(path);
  if (path !== "index.html" && !PUBLIC.some((p) => path.startsWith(p))) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const file = join(root, path);
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => {
  const mode = process.env.MOCK_AI === "1" ? " (mock AI mode)" : "";
  console.log(`AP study site running at http://localhost:${PORT}${mode}`);
});
