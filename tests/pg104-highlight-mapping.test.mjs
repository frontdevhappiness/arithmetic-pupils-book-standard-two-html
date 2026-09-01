import assert from "node:assert/strict";
import fs from "node:fs";

const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const page = fs.readFileSync("pg104_sec001.html", "utf8");
const timecodes = JSON.parse(
  fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"),
);
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.match(bridge, /function buildPage104Map/);
assert.match(bridge, /id !== "pg104_p001" && id !== "pg104_p006"/);
assert.match(bridge, /introduction\.length === 56/);
assert.match(bridge, /introduction\.push\(\[introWords\[34\], introWords\[35\]\]\)/);
assert.match(bridge, /mapping\.length === 68/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=66/);

for (const [id, count] of [["pg104_p001", 56], ["pg104_p006", 68]]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, count, `${id} must map every narrated token`);
  assert.ok(new Set(words.map(({ start, end }) => (end - start).toFixed(3))).size > 20, `${id} must use non-uniform natural-speech timing`);
  for (let index = 1; index < words.length; index += 1) {
    assert.ok(words[index].start >= words[index - 1].end, `${id} timestamps must not overlap`);
  }
}

const intro = timecodes.pg104_p001.timecodes[1].word_timestamps;
assert.ok(intro[2].start >= 1.35, "the chapter title must wait for its measured pause");
assert.ok(intro[10].start >= 5.98, "the introduction must wait for the topic heading");
assert.ok(intro.at(-1).end <= 21.61, "introduction highlighting must stop with the narration");

const examples = timecodes.pg104_p006.timecodes[1].word_timestamps;
assert.deepEqual([0, 34].map((index) => examples[index].text), ["Example", "Example"]);
assert.ok(examples[2].start >= 1.76, "Example 1 table summary must wait for the heading pause");
assert.ok(examples[34].start >= 12.94, "Example 2 must wait for Example 1 to finish");
assert.ok(examples.at(-1).end <= 25.105, "table highlighting must stop with the narration");

assert.deepEqual(
  offline["./content/i18n/en-GB/timecode/timecode_output.json"],
  timecodes,
  "offline page 104 timestamps must match the network-loaded data",
);
assert.equal(offline["./pg104_sec001.html"], page, "offline page 104 must match the edited page");
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge, "offline bridge must include page 104 mapping");
