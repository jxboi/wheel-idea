#!/usr/bin/env node
// Verification harness for Orbit. Starts an isolated `server/dev.ts` instance,
// health-checks it, drives it with Playwright flows, and tears down only what
// it started. Evidence lives under .verify-orbit/<run>/evidence and survives stop.
//
//   orbit-verify.mjs launch                      -> prints RUN=<id> URL=<url>
//   orbit-verify.mjs doctor <run>
//   orbit-verify.mjs drive  <run> <flow.mjs> [--viewport mobile|desktop] [--label name]
//   orbit-verify.mjs stop   <run>
//   orbit-verify.mjs list
import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = execSync("git rev-parse --show-toplevel").toString().trim();
const root = path.join(repo, ".verify-orbit");
const runDir = (run) => path.join(root, run);
const stateFile = (run) => path.join(runDir(run), "state.json");
const [cmd, ...args] = process.argv.slice(2);

function fail(message) {
  console.error(`orbit-verify: ${message}`);
  process.exit(1);
}
function readState(run) {
  if (!run) fail("missing <run>. Run `list` to see runs.");
  if (!fs.existsSync(stateFile(run))) fail(`no run ${run} under ${root}`);
  return JSON.parse(fs.readFileSync(stateFile(run), "utf8"));
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}
function loadPlaywright() {
  const tryFrom = (base) => {
    try {
      return createRequire(base)("playwright");
    } catch {
      return null;
    }
  };
  const pw =
    tryFrom(path.join(repo, "package.json")) ||
    tryFrom(execSync("npm root -g").toString().trim() + "/");
  if (!pw)
    fail(
      "Playwright not found. Install it outside the project: `npm i -g playwright && npx playwright install chromium`.",
    );
  return pw;
}

async function launch() {
  if (!fs.existsSync(path.join(repo, "node_modules", ".bin", "tsx")))
    fail("node_modules missing. Run `npm ci` first.");
  const run = `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`;
  const dir = runDir(run);
  fs.mkdirSync(path.join(dir, "evidence"), { recursive: true });
  const port = await freePort();
  const log = fs.openSync(path.join(dir, "server.log"), "a");
  // Blank keys override any .env so no drive can reach a paid provider.
  const env = {
    ...process.env,
    PORT: String(port),
    OPENROUTER_API_KEY: "",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    ORBIT_ACCESS_TOKEN: "",
    ORBIT_ENABLE_LOCAL_CLI: "false",
  };
  const child = spawn(
    path.join(repo, "node_modules", ".bin", "tsx"),
    ["server/dev.ts"],
    { cwd: repo, env, detached: true, stdio: ["ignore", log, log] },
  );
  child.unref();
  const url = `http://127.0.0.1:${port}`;
  const state = {
    run,
    pid: child.pid,
    port,
    url,
    commit: execSync("git rev-parse --short HEAD", { cwd: repo })
      .toString()
      .trim(),
    startedAt: new Date().toISOString(),
  };
  fs.writeFileSync(stateFile(run), JSON.stringify(state, null, 2));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const text = fs.readFileSync(path.join(dir, "server.log"), "utf8");
    if (text.includes(`Orbit is ready at ${url}`)) {
      console.log(`RUN=${run} URL=${url} PID=${child.pid}`);
      console.log(`evidence: ${path.join(dir, "evidence")}`);
      return;
    }
    if (!alive(child.pid)) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  stopRun(run);
  fail(`server did not become ready; see ${path.join(dir, "server.log")}`);
}

async function doctor(run) {
  const s = readState(run);
  const checks = [];
  const check = (name, ok, detail = "") => {
    checks.push(ok);
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
  };
  check("server process alive", alive(s.pid), `pid ${s.pid}`);
  const log = fs.readFileSync(path.join(runDir(run), "server.log"), "utf8");
  check("ready line for our port", log.includes(`Orbit is ready at ${s.url}`));
  if (log.includes("Port 24678 is already in use"))
    console.log(
      "note HMR socket shared with another Vite dev server; ignore HMR, reload instead",
    );
  const head = execSync("git rev-parse --short HEAD", { cwd: repo })
    .toString()
    .trim();
  check("same commit as launch", head === s.commit, `${s.commit} -> ${head}`);
  try {
    const html = await (await fetch(s.url + "/")).text();
    check("serves Orbit shell", html.includes('id="root"'));
  } catch (e) {
    check("serves Orbit shell", false, e.message);
  }
  try {
    // A schema-valid request with no key must be refused before any provider call.
    const res = await fetch(s.url + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "Games",
        duration: "A few hours",
        mood: "",
        settings: {
          provider: "openrouter",
          model: "doctor/probe",
          effort: "default",
          useMemory: false,
        },
        context: "{}",
      }),
    });
    const body = await res.json();
    check(
      "API up and holds no server key",
      res.status === 401 && /Connect an API key/.test(body.error),
      `${res.status} ${body.error}`,
    );
  } catch (e) {
    check("API up and holds no server key", false, e.message);
  }
  if (checks.includes(false)) process.exit(1);
}

async function drive(run, flowPath, opts) {
  const s = readState(run);
  if (!alive(s.pid)) fail(`run ${run} is not running; launch a new one`);
  const flow = path.resolve(flowPath);
  const label =
    opts.label || `${path.basename(flow, ".mjs")}-${opts.viewport || "mobile"}`;
  const out = path.join(runDir(run), "evidence", label);
  fs.mkdirSync(out, { recursive: true });
  const steps = fs.createWriteStream(path.join(out, "steps.log"));
  const log = (line) => {
    const text = `${new Date().toISOString()} ${line}`;
    steps.write(text + "\n");
    console.log(text);
  };
  const { chromium } = loadPlaywright();
  const viewport =
    opts.viewport === "desktop"
      ? { width: 1440, height: 900 }
      : { width: 390, height: 844 };
  const browser = await chromium.launch();
  // A fresh context is a fresh profile: empty IndexedDB, nothing of the user's.
  const context = await browser.newContext({
    viewport,
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  let n = 0;
  const proof = async (name) => {
    const base = path.join(out, `${String(++n).padStart(2, "0")}-${name}`);
    await page.screenshot({ path: `${base}.png` });
    fs.writeFileSync(`${base}.aria.txt`, await page.locator("body").ariaSnapshot());
    log(`proof ${path.relative(repo, base)}.{png,aria.txt}`);
  };
  const noOverflow = async () => {
    const [doc, win] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    if (doc > win) throw new Error(`horizontal overflow: ${doc}px > ${win}px`);
    log(`no horizontal overflow (${doc}px)`);
  };
  log(`drive ${path.relative(repo, flow)} at ${s.url} ${viewport.width}x${viewport.height}`);
  let failed = null;
  let allow = [];
  try {
    const mod = await import(pathToFileURL(flow).href);
    allow = mod.allowConsole || [];
    await page.goto(s.url + "/");
    await page.getByRole("button", { name: "Spin the wheel" }).first().waitFor();
    await mod.default({ page, context, url: s.url, out, log, proof, noOverflow, expect: expectFn() });
  } catch (e) {
    failed = e;
    log(`FAILED ${e.message}`);
    await proof("failure").catch(() => {});
  } finally {
    await browser.close();
  }
  // Vite HMR noise appears when another dev server owns port 24678; the app
  // does not depend on HMR. Flows list any expected errors in `allowConsole`.
  const hmr = /\[vite\]|ws:\/\/127\.0\.0\.1:24678|WebSocket closed without opened/;
  const unexpected = problems.filter(
    (p) => !hmr.test(p) && !allow.some((re) => re.test(p)),
  );
  for (const p of problems) log(p);
  steps.end();
  if (failed || unexpected.length) {
    console.error(`FAIL ${label}: evidence in ${path.relative(repo, out)}`);
    process.exit(1);
  }
  console.log(`PASS ${label}: evidence in ${path.relative(repo, out)}`);
}

// Minimal assertions so flows need no test runner.
function expectFn() {
  return async (locator, what = "visible", timeout = 10_000) => {
    if (what === "visible") await locator.first().waitFor({ state: "visible", timeout });
    else if (what === "hidden") await locator.first().waitFor({ state: "hidden", timeout });
    else if (what === "absent") {
      const count = await locator.count();
      if (count) throw new Error(`expected none, found ${count}: ${locator}`);
    } else throw new Error(`unknown expectation ${what}`);
  };
}

function stopRun(run) {
  const s = readState(run);
  if (alive(s.pid)) {
    // detached => the server is its own process group; kill only that group.
    try {
      process.kill(-s.pid, "SIGTERM");
    } catch {
      process.kill(s.pid, "SIGTERM");
    }
  }
  s.stoppedAt = new Date().toISOString();
  fs.writeFileSync(stateFile(run), JSON.stringify(s, null, 2));
  console.log(`stopped ${run}; evidence kept at ${path.join(runDir(run), "evidence")}`);
}

function list() {
  if (!fs.existsSync(root)) return console.log("no runs");
  for (const run of fs.readdirSync(root).sort()) {
    if (!fs.existsSync(stateFile(run))) continue;
    const s = readState(run);
    console.log(`${run}  ${alive(s.pid) && !s.stoppedAt ? "RUNNING" : "stopped"}  ${s.url}`);
  }
}

const opts = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--viewport") opts.viewport = args[++i];
  else if (args[i] === "--label") opts.label = args[++i];
  else positional.push(args[i]);
}
if (cmd === "launch") await launch();
else if (cmd === "doctor") await doctor(positional[0]);
else if (cmd === "drive") {
  if (!positional[1]) fail("usage: drive <run> <flow.mjs> [--viewport mobile|desktop]");
  await drive(positional[0], positional[1], opts);
} else if (cmd === "stop") stopRun(positional[0]);
else if (cmd === "list") list();
else fail("usage: launch | doctor <run> | drive <run> <flow> | stop <run> | list");
