import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg110_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage110Map/);
assert.match(bridge, /continuationMap\.length === 44/);
assert.match(bridge, /articleMap\.length === 107/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=77/);
assert.equal((page.match(/pg110-question-zone q[789]/g) || []).length, 3);

for (const [id, count, minimumDurations] of [["pg110_p001", 44, 20], ["pg110_p004", 107, 40]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size >= minimumDurations, `${id} must use natural non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const continuation = timecodes.pg110_p001.timecodes[1].word_timestamps;
for (const [index, minimum] of [[3, 1.84], [12, 5.62], [28, 11.35]]) {
  assert.ok(continuation[index].start >= minimum, `continued question at token ${index} must wait for its measured pause`);
}
assert.ok(continuation.at(-1).end <= 16.581, "continued exercise highlighting must finish with the narration");

const article = timecodes.pg110_p004.timecodes[1].word_timestamps;
for (const [index, minimum] of [[8, 3.54], [19, 7.42], [38, 13.99], [56, 20.89], [65, 23.92], [74, 27.17], [81, 29.5], [90, 32.21], [102, 36.12]]) {
  assert.ok(article[index].start >= minimum, `article section at token ${index} must wait for its measured pause`);
}
assert.ok(article.at(-1).end <= 37.54, "article highlighting must finish with the original narration");
assert.deepEqual(article.slice(45, 48).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "After", start: 16.5, end: 16.82 },
  { text: "removing", start: 16.82, end: 17.24 },
  { text: "one-third", start: 17.24, end: 17.76 },
]);
assert.deepEqual(article.slice(51, 56).map(({ text, start, end }) => ({ text, start, end })), [
  { text: "the", start: 18.81, end: 18.89 },
  { text: "remaining", start: 18.89, end: 19.37 },
  { text: "part", start: 19.37, end: 19.64 },
  { text: "is", start: 19.64, end: 19.81 },
  { text: "two-thirds", start: 19.81, end: 20.52 },
]);

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg110_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
