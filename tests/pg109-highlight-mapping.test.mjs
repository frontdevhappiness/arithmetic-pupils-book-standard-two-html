import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg109_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage109Map/);
assert.match(bridge, /continuationMap\.length === 96/);
assert.match(bridge, /exerciseMap\.length === 104/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=74/);

for (const [id, count] of [["pg109_p001", 96], ["pg109_p015", 104]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 20, `${id} must use natural non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const continuation = timecodes.pg109_p001.timecodes[1].word_timestamps;
for (const [index, minimum] of [[3, 2.29], [23, 9.98], [49, 19.95], [75, 29.61]]) {
  assert.ok(continuation[index].start >= minimum, `continued question at token ${index} must wait for its measured pause`);
}
assert.ok(continuation[39].start >= 16.35, "question 3 answer must wait for its picture description");
assert.ok(continuation[65].start >= 26.11, "question 4 answer must wait for its picture description");
assert.deepEqual(continuation.slice(-5).map(({ text }) => text), ["Write", "the", "fraction", "in", "words"]);
assert.ok(continuation.at(-1).end <= 36.83, "continued exercise highlighting must finish after words");
assert.match(texts.pg109_p001, /Write the fraction in words\.$/);
assert.doesNotMatch(texts.pg109_p001, /and numerals/);

const exercise = timecodes.pg109_p015.timecodes[1].word_timestamps;
for (const [index, minimum] of [[14, 5.53], [29, 10.86], [44, 16.49], [58, 21.5], [74, 26.75], [89, 32.64]]) {
  assert.ok(exercise[index].start >= minimum, `Exercise 4 question at token ${index} must wait for its measured pause`);
}
assert.ok(exercise.at(-1).end <= 37.434, "Exercise 4 highlighting must finish with the narration");

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.equal(offline["./pg109_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
