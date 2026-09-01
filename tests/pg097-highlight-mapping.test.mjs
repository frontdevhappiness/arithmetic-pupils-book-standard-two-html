import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage97Map/);
assert.match(bridge, /descriptionLengths = \[11, 5, 5, 5\]/);
assert.match(bridge, /return mapping\.length === 56/);

const words = timecodes.pg097_p001.timecodes[1].word_timestamps;
assert.equal(words.length, 56, "page 97 must time every visible and spoken token");
assert.equal(words.filter(({ text }) => text === "÷").length, 4, "all division signs must be highlighted");
assert.equal(words.filter(({ text }) => text === "=").length, 4, "all equals signs must be highlighted");
assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 10, "page 97 must use measured, non-uniform timing");

assert.deepEqual(
  words.slice(22, 26).map(({ text }) => text),
  ["18", "÷", "3", "="],
);
assert.deepEqual(
  words.slice(52, 56).map(({ text }) => text),
  ["20", "÷", "5", "="],
);
assert.ok(words[10].start >= 5.2, "question 1 must wait for its measured pause");
assert.ok(words[26].start >= 13.02, "question 2 must wait for its measured pause");
assert.ok(words[36].start >= 18.68, "question 3 must wait for its measured pause");
assert.ok(words[46].start >= 23.77, "question 4 must wait for its measured pause");
