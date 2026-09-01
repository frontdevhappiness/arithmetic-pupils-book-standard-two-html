import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("pg095_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

for (const number of [1, 2, 3]) {
  assert.match(
    page,
    new RegExp(`<span class="question-number">${number}\\.<\\/span>`),
    `activity question ${number} must be real highlightable text`,
  );
}
assert.doesNotMatch(page, /\.questions li::before\s*\{/);

assert.match(bridge, /function buildPage95Map/);
assert.match(bridge, /return mapping\.length === 56/);
assert.match(bridge, /index < 15/);
assert.match(bridge, /return mapping\.length === 64/);

assert.equal(timecodes.pg095_p001.timecodes[1].word_timestamps.length, 56);
assert.equal(timecodes.pg095_p009.timecodes[1].word_timestamps.length, 64);
