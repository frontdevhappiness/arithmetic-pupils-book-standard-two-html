import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg115_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage115Map/);
assert.match(bridge, /questionMap\.length === 24/);
assert.match(bridge, /exerciseMap\.length === 91/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=81/);

for (const [id, count, minimumDurations] of [["pg115_p001", 24, 15], ["pg115_p004", 91, 25]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(2))).size >= minimumDurations, `${id} must use measured non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const question = timecodes.pg115_p001.timecodes[1].word_timestamps;
assert.deepEqual(question.slice(0, 3).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "2", start: 0.09, end: 0.54 },
  { text: "Write", start: 0.94, end: 1.29 },
  { text: "two-thirds", start: 1.33, end: 2.19 },
]);
assert.equal(question.at(-1).end, 9.99);

const exercise = timecodes.pg115_p004.timecodes[1].word_timestamps;
assert.deepEqual([26, 45, 56, 67, 79].map(index => {
  const { text, start, end } = exercise[index];
  return { text, start, end };
}), [
  { text: "1", start: 10.24, end: 10.68 },
  { text: "2", start: 16.74, end: 17.11 },
  { text: "3", start: 20.46, end: 20.97 },
  { text: "4", start: 24.02, end: 24.55 },
  { text: "5", start: 27.89, end: 28.37 },
]);
assert.equal(exercise.at(-1).end, 31.69);

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg115_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
