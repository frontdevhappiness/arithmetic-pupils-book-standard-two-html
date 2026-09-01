import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg108_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage108Map/);
assert.match(bridge, /exampleMap\.length === 102/);
assert.match(bridge, /exerciseMap\.length === 43/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=72/);

for (const [id, count] of [["pg108_p001", 102], ["pg108_p034", 43]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 20, `${id} must use natural non-uniform timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const examples = timecodes.pg108_p001.timecodes[1].word_timestamps;
assert.ok(examples[2].start >= 1.28, "Example 1 description must wait for its heading");
assert.ok(examples[16].start >= 6.07, "Example 1 pieces must wait for the whole-object description");
assert.ok(examples[30].start >= 11.7, "Example 2 must wait for Example 1");
assert.ok(examples[60].start >= 23.05, "Example 3 must wait for Example 2");
assert.ok(examples[72].start >= 27.36, "Example 3 quarter sequence must wait for its overview");
assert.ok(examples.at(-1).end <= 35.304, "example highlighting must finish with the narration");

const exercise = timecodes.pg108_p034.timecodes[1].word_timestamps;
assert.ok(exercise[2].start >= 1.72, "exercise directions must wait for the heading");
assert.ok(exercise[14].start >= 6.27, "question 1 must wait for the directions");
assert.ok(exercise[15].start >= 7.65, "question description must wait for the number");
assert.ok(exercise[29].start >= 12.61, "answer wording must wait for the picture description");
assert.ok(exercise[35].start >= 14.53, "blank instruction must wait for the answer wording");
assert.ok(exercise.at(-1).end <= 16.772, "exercise highlighting must finish with the narration");

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg108_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
