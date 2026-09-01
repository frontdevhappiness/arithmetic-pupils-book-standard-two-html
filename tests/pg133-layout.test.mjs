import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("pg133_sec001.html", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.doesNotMatch(page, /font-style\s*:\s*italic/, "page 133 labels must not be italic");
assert.match(page, /\.pg133-object em \{[^}]*font-style:normal;/);
assert.match(page, /\.pg133-marker \{[^}]*position:absolute;[^}]*z-index:2;[^}]*bottom:1\.25rem;/);
assert.match(page, /@media \(max-width:44rem\)[\s\S]*\.pg133-marker \{ bottom:\.75rem; \}/);
assert.match(page, /<p class="pg133-marker">127<\/p>/);
assert.equal(offline["./pg133_sec001.html"], page);
