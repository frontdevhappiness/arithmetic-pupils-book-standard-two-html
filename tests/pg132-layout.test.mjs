import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("pg132_sec001.html", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.doesNotMatch(page, /font-style\s*:\s*italic/, "page 132 labels must not be italic");
assert.match(page, /\.pg132-tool figcaption \{[^}]*font-style:normal;/);
assert.match(page, /\.pg132-choice figcaption \{[^}]*font-style:normal;/);
assert.match(page, /\.pg132-marker \{[^}]*position:absolute;[^}]*z-index:2;[^}]*bottom:1\.75rem;/);
assert.match(page, /@media \(max-width:44rem\)[\s\S]*\.pg132-marker \{ bottom:1\.25rem; \}/);
assert.equal(offline["./pg132_sec001.html"], page);
