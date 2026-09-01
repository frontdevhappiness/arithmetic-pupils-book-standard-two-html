import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);

assert.match(bridge, /function buildPage96Map/);
assert.match(bridge, /id === "pg096_p001" \? 21 : 15/);
assert.match(bridge, /id === "pg096_p001" \? 56 : 38/);

assert.equal(timecodes.pg096_p001.timecodes[1].word_timestamps.length, 56);
assert.equal(timecodes.pg096_p015.timecodes[1].word_timestamps.length, 38);

assert.deepEqual(
  timecodes.pg096_p001.timecodes[1].word_timestamps.slice(43, 50).map(({ text }) => text),
  ["Thus", "9", "÷", "3", "=", "3", "Therefore"],
  "Example 2 must resume from its diagram at Thus and then Therefore",
);
assert.deepEqual(
  timecodes.pg096_p015.timecodes[1].word_timestamps.slice(23, 30).map(({ text }) => text),
  ["Thus", "8", "÷", "4", "=", "2", "Therefore"],
  "Example 3 must resume from its diagram at Thus and then Therefore",
);
