import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg105_sec001.html", "utf8");
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage105Map/);
assert.match(bridge, /id !== "pg105_p001" && id !== "pg105_p011"/);
assert.match(bridge, /exampleMap\.length === 57/);
assert.match(bridge, /exerciseMap\.length === 69/);
assert.match(page, /data-id="pg105_p020"><\/span>/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=70/);

for (const [id, count] of [["pg105_p001", 57], ["pg105_p011", 69]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 20, `${id} must use non-uniform natural-speech timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const example = timecodes.pg105_p001.timecodes[1].word_timestamps;
assert.ok(example[2].start >= 1.11, "the table summary must wait for the Example 3 pause");
assert.ok(example[34].start >= 12.65, "Writing a half must wait for the table narration");
assert.ok(example[37].start >= 14.22, "the explanation must wait for its heading pause");
assert.ok(example.at(-1).end <= 19.885, "example highlighting must stop with the narration");

const exercise = timecodes.pg105_p011.timecodes[1].word_timestamps;
assert.ok(exercise[2].start >= 1.54, "directions must wait for the Exercise 1 pause");
assert.ok(exercise[18].start >= 6.05, "question 1 must wait for the directions");
assert.ok(exercise[43].start >= 15.01, "question 2 must wait for question 1");
assert.ok(exercise.at(-1).end <= 26.13, "exercise highlighting must stop with the narration");

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes, "offline timings must match network data");
assert.equal(offline["./pg105_sec001.html"], page, "offline page 105 must match the edited page");
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge, "offline bridge must include page 105 mapping");
