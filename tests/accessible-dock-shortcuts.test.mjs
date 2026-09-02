import assert from "node:assert/strict";
import fs from "node:fs";

const localBundle = fs.readFileSync("assets/base.bundle.local.js", "utf8");
const minBundle = fs.readFileSync("assets/base.bundle.min.js", "utf8");
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const payloadStart = offlineSource.indexOf(prefix) + prefix.length;
const payloadEnd = offlineSource.indexOf(";\n  var BASE_DIR", payloadStart);
const offline = JSON.parse(offlineSource.slice(payloadStart, payloadEnd));

for (const source of [localBundle, minBundle]) {
  assert.match(source, /groups: \[\["Alt", "Shift", "X"\]\]/);
  assert.match(source, /groups: \[\["Alt", "Shift", "A"\]\]/);
  assert.match(source, /groups: \[\["Alt", "Shift", "L"\]\]/);
  assert.match(source, /groups: \[\["Esc"\]\]/);

  assert.match(source, /useHotkey\("Alt\+Shift\+X", \(\) => toggle\("toc"\)\)/);
  assert.match(source, /useHotkey\("Alt\+Shift\+A", \(\) => toggle\("settings"\)\)/);
  assert.match(source, /useHotkey\("Alt\+Shift\+L", \(\) => toggle\("language"\)\)/);
  assert.match(source, /useHotkey\("Escape", \(\) => setValue\(""\)/);

  assert.doesNotMatch(source, /useHotkey\("[XAL]",/);
}

assert.match(config.bundleVersion, /-accessible-dock-shortcuts-1$/);
assert.deepEqual(offline["./assets/config.json"], config);

console.log("Dock shortcuts use screen-reader-safe key combinations and match their displayed instructions.");
