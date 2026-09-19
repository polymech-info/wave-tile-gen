/**
 * Hoist TanStack Start `dist-flat/client/*` to `dist-flat/*` and drop `client/`.
 * Optionally removes `server/` for static-only hosting.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.env.DIST_FLAT ?? "dist-flat");
const clientDir = path.join(ROOT, "client");
const serverDir = path.join(ROOT, "server");

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

if (fs.existsSync(clientDir)) {
  for (const name of fs.readdirSync(clientDir)) {
    const from = path.join(clientDir, name);
    const to = path.join(ROOT, name);
    if (fs.existsSync(to)) rmrf(to);
    fs.renameSync(from, to);
  }
  rmrf(clientDir);
}

const shell = path.join(ROOT, "_shell.html");
const idx = path.join(ROOT, "index.html");
if (fs.existsSync(shell) && !fs.existsSync(idx)) {
  fs.renameSync(shell, idx);
}

rmrf(serverDir);
