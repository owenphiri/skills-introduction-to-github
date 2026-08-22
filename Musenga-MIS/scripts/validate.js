#!/usr/bin/env node
// Sanity-checks public/index.html before it ships: confirms the file is a
// well-formed HTML document and that every inline <script> block is at
// least syntactically valid JavaScript. This is a single hand-authored HTML
// file with no build step, so this is the safety net that stands in for a
// bundler/type-checker catching a typo before it reaches production.
const fs = require("node:fs");
const path = require("node:path");

const file = path.join(__dirname, "..", "public", "index.html");
const html = fs.readFileSync(file, "utf8");

let failed = false;

if (!/^<!DOCTYPE html>/i.test(html.trim())) {
  console.error("FAIL: missing <!DOCTYPE html> at the top of " + file);
  failed = true;
}

if (html.length < 100_000) {
  console.error(`FAIL: ${file} is suspiciously small (${html.length} bytes) — looks truncated`);
  failed = true;
}

// Note: this file embeds full printable HTML documents (certificates,
// reports) inside JS template-literal strings, so a naive <html> tag count
// would double-count those and false-positive. We don't attempt that check.

const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
let syntaxErrors = 0;
while ((match = scriptRe.exec(html))) {
  count++;
  const code = match[1];
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
  } catch (err) {
    syntaxErrors++;
    const line = html.slice(0, match.index).split("\n").length;
    console.error(`FAIL: syntax error in inline <script> block #${count} (starts near line ${line}): ${err.message}`);
  }
}
if (count === 0) {
  console.error("FAIL: no inline <script> blocks found — is this the right file?");
  failed = true;
}
if (syntaxErrors > 0) {
  failed = true;
}

if (failed) {
  console.error(`\nvalidate.js: FAILED (${syntaxErrors} script syntax error(s))`);
  process.exit(1);
}

console.log(`validate.js: OK — checked ${count} inline script block(s), 0 syntax errors, well-formed HTML shell.`);
