import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg114_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage114Map/);
assert.match(bridge, /exerciseFiveMap\.length === 130/);
assert.match(bridge, /exerciseSixMap\.length === 30/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=80/);

for (const [id, count, minimumDurations] of [["pg114_p001", 130, 25], ["pg114_p011", 30, 15]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(2))).size >= minimumDurations, `${id} must use measured non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const exerciseFive = timecodes.pg114_p001.timecodes[1].word_timestamps;
assert.deepEqual([12, 26, 40, 54, 69, 85, 99, 116].map(index => {
  const { text, start, end } = exerciseFive[index];
  return { text, start, end };
}), [
  { text: "1", start: 4.62, end: 4.98 },
  { text: "2", start: 9.59, end: 9.99 },
  { text: "3", start: 14.84, end: 15.26 },
  { text: "4", start: 19.84, end: 20.58 },
  { text: "5", start: 25.29, end: 25.76 },
  { text: "6", start: 31, end: 31.51 },
  { text: "7", start: 36.71, end: 37.21 },
  { text: "8", start: 42.89, end: 43.25 },
]);
assert.equal(exerciseFive.at(-1).end, 47.4);

const exerciseSix = timecodes.pg114_p011.timecodes[1].word_timestamps;
assert.deepEqual(exerciseSix.slice(0, 3).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "Exercise", start: 0.09, end: 0.66 },
  { text: "6", start: 0.66, end: 1.22 },
  { text: "Answer", start: 1.77, end: 2.08 },
]);
assert.equal(exerciseSix.at(-1).end, 13.51);

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg114_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
