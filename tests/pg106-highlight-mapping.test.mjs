import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg106_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage106Map/);
assert.match(bridge, /mapping\.length === 121/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=69/);

const narration = timecodes.pg106_p001.timecodes[1].word_timestamps;
assert.equal(narration.length, 121, "page 106 must map every narrated token");
assert.ok(new Set(narration.map(({ start, end }) => (end - start).toFixed(3))).size > 20, "page 106 must use natural non-uniform timing");
for (let index = 1; index < narration.length; index += 1) {
  assert.ok(narration[index].start >= narration[index - 1].end, "page 106 timestamps must not overlap");
}
assert.ok(narration[3].start >= 2.27, "question 3 must wait for the introduction pause");
assert.ok(narration[27].start >= 10.36, "question 4 must wait for question 3");
assert.ok(narration[52].start >= 18.18, "question 5 must wait for question 4");
assert.ok(narration[76].start >= 28.24, "question 6 must wait for question 5");
assert.ok(narration[95].start >= 35.12, "question 7 must wait for question 6");
assert.ok(narration.at(-1).end <= 43.468, "highlighting must finish with the narration");

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg106_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
