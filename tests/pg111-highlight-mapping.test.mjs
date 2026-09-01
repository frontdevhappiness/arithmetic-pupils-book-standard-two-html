import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg111_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage111Map/);
assert.match(bridge, /diagramMap\.length === 40/);
assert.match(bridge, /activityMap\.length === 48/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=78/);

for (const [id, count, minimumDurations] of [["pg111_p001", 40, 20], ["pg111_p017", 48, 24]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size >= minimumDurations, `${id} must use measured non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const diagram = timecodes.pg111_p001.timecodes[1].word_timestamps;
assert.deepEqual(diagram.slice(20, 23).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "removed", start: 7.24, end: 7.76 },
  { text: "is", start: 7.76, end: 7.98 },
  { text: "one-third", start: 7.98, end: 8.79 },
]);
assert.deepEqual(diagram.slice(35, 40).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "two-thirds", start: 13.62, end: 14.46 },
  { text: "Two-thirds", start: 14.82, end: 15.53 },
  { text: "2", start: 15.82, end: 16.07 },
  { text: "over", start: 16.07, end: 16.24 },
  { text: "3", start: 16.24, end: 16.66 },
]);

const activity = timecodes.pg111_p017.timecodes[1].word_timestamps;
assert.deepEqual(activity.slice(1, 5).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "Let", start: 1.09, end: 1.29 },
  { text: "us", start: 1.29, end: 1.46 },
  { text: "play", start: 1.46, end: 1.72 },
  { text: "a", start: 1.72, end: 1.83 },
]);
assert.equal(activity.at(-1).end, 16.97);

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg111_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
