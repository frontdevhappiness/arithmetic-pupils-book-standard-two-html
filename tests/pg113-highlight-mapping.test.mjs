import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg113_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage113Map/);
assert.match(bridge, /numberedItems\("\.pg113-one-item"\)/);
assert.match(bridge, /oneMap\.length === 80/);
assert.match(bridge, /twoMap\.length === 82/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=79/);

for (const [id, count, minimumDurations] of [["pg113_p001", 80, 25], ["pg113_p007", 82, 25]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(2))).size >= minimumDurations, `${id} must use measured non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const exampleOne = timecodes.pg113_p001.timecodes[1].word_timestamps;
assert.deepEqual(exampleOne.slice(0, 4).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "Example", start: 0.15, end: 0.84 },
  { text: "1", start: 0.84, end: 1.24 },
  { text: "Recognize", start: 1.73, end: 2.39 },
  { text: "one-third", start: 2.39, end: 3.09 },
]);
assert.deepEqual(exampleOne.filter(({ text }) => /^[1-4]$/.test(text)).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "1", start: 0.84, end: 1.24 },
  { text: "1", start: 5.12, end: 5.49 },
  { text: "2", start: 11.59, end: 12.03 },
  { text: "3", start: 18.32, end: 18.75 },
  { text: "4", start: 25.34, end: 25.8 },
]);
assert.equal(exampleOne.at(-1).end, 31.03);

const exampleTwo = timecodes.pg113_p007.timecodes[1].word_timestamps;
assert.deepEqual(exampleTwo.slice(0, 4).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "Example", start: 0.04, end: 0.71 },
  { text: "2", start: 0.71, end: 1.29 },
  { text: "Recognize", start: 1.69, end: 2.43 },
  { text: "two-thirds", start: 2.43, end: 3.07 },
]);
assert.equal(exampleTwo.at(-1).end, 31.08);

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg113_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
