import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("pg039_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));

assert.match(bridge, /function buildPage39ModelMap/);
assert.match(bridge, /source\.closest\("\.place-model"\)/);
assert.match(bridge, /assign\(3, 6, headers\[0\]\)/);
assert.match(bridge, /mapping\[16\] = equals\[0\]/);
assert.match(bridge, /assign\(17, 20, headers\[1\]\)/);
assert.match(bridge, /mapping\[30\] = equals\[1\]/);
assert.match(bridge, /assign\(31, 34, headers\[2\]\)/);
assert.match(bridge, /mapping\[44\] = equals\[2\]/);
assert.match(bridge, /assign\(45, 50, answers\)/);
assert.match(bridge, /assign\(51, 54, finalLine\)/);
assert.ok(page.indexOf('data-id="pg039_p039"') < page.indexOf('data-id="pg039_p020"'));
assert.equal(timecodes.pg039_p039.timecodes[1].word_timestamps.length, 55);
assert.equal(timecodes.pg039_p040.timecodes[1].word_timestamps.length, 55);
for (const id of ["pg039_p039", "pg039_p040"]) {
  assert.equal((texts[id].match(/Equals/g) || []).length, 3);
  assert.equal(audios[id], `${id}_adt_model_equals.mp3`);
  assert.deepEqual(
    timecodes[id].timecodes[1].word_timestamps
      .map(({ text }, index) => text === "Equals" ? index : null)
      .filter((index) => index !== null),
    [16, 30, 44],
  );
  assert.ok(fs.statSync(`content/i18n/en-GB/audio/${audios[id]}`).size > 1000);
}

console.log("Page 39 model narration is constrained to its local columns and answer lines.");
