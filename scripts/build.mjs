// Baut die statische Seite nach dist/: TypeScript kompilieren, public/ kopieren.
// Mit --watch: neu bauen bei Änderungen und dist/ auf http://localhost:5173 ausliefern.
import { execSync, spawn } from "node:child_process";
import { cpSync, rmSync, mkdirSync, watch, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const watchMode = process.argv.includes("--watch");
const tsc = existsSync(join(root, "node_modules/.bin/tsc")) ? join(root, "node_modules/.bin/tsc") : "tsc";

function copyPublic() {
  cpSync(join(root, "public"), dist, { recursive: true });
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
copyPublic();

if (!watchMode) {
  execSync(`${tsc} -p ${join(root, "tsconfig.json")}`, { stdio: "inherit" });
  console.log("Fertig: dist/");
} else {
  spawn(tsc, ["-p", join(root, "tsconfig.json"), "--watch", "--preserveWatchOutput"], { stdio: "inherit" });
  watch(join(root, "public"), { recursive: true }, copyPublic);

  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
  createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = join(dist, path.endsWith("/") ? path + "index.html" : path);
    if (!file.startsWith(dist) || !existsSync(file)) {
      res.writeHead(404).end("Nicht gefunden");
      return;
    }
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(file));
  }).listen(5173, () => console.log("Läuft auf http://localhost:5173"));
}
