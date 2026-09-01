import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg118_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage118Map/);
assert.match(bridge, /descriptionLengths = \[14, 14, 6, 15, 15, 18\]/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=83/);
assert.doesNotMatch(page, /font-style\s*:\s*italic/, "page 118 text must use upright styling");

for (const [id, count, minimumDurations] of [["pg118_p001", 101, 30], ["pg118_p010", 12, 8]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must time every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size >= minimumDurations, `${id} must use measured non-uniform speech timings`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const exercise = timecodes.pg118_p001.timecodes[1].word_timestamps;
assert.deepEqual([13, 28, 43, 50, 66, 82].map(index => {
  const { text, start, end } = exercise[index];
  return { text, start, end };
}), [
  { text: "1", start: 5.68, end: 6.08 },
  { text: "2", start: 11.09, end: 11.46 },
  { text: "3", start: 15.98, end: 16.42 },
  { text: "4", start: 18.93, end: 19.45 },
  { text: "5", start: 24.45, end: 24.95 },
  { text: "6", start: 30.34, end: 30.87 },
]);
assert.deepEqual(exercise.slice(2, 5).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "Write", start: 1.56, end: 1.91 },
  { text: "in", start: 1.94, end: 2.1 },
  { text: "numerals", start: 2.1, end: 2.65 },
]);
assert.deepEqual(exercise.at(-1), { text: "right", start: 36.03, end: 36.4 });

const ict = timecodes.pg118_p010.timecodes[1].word_timestamps;
assert.deepEqual(ict[4], { text: "ICT", start: 1.85, end: 2.62 });
assert.deepEqual(ict[11], { text: "ICT", start: 4.99, end: 5.66 });

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg118_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
