import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const page = fs.readFileSync("pg117_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(
  texts.pg117_p001,
  "Exercise 9. Fill in the blanks. The table columns are Fraction in numerals and Fraction in words. 1. 1 over 2. Blank in words. 2. Blank in numerals. One-third. 3. 1 over 4. Blank in words. 4. 1. Blank in words. 5. Blank in numerals. Half. 6. Blank in numerals. Whole object.",
);
assert.equal(
  texts.pg117_p020,
  "7. 1 over 3. Blank in words. 8. Blank in numerals. Two-thirds. 9. 2 over 3. Blank in words. 10. Blank in numerals. One-fourth. 11. Blank in numerals. One-third.",
);
assert.equal(texts.pg117_p033, "12. Blank in numerals. Two-thirds.");

const combined = `${texts.pg117_p001} ${texts.pg117_p020} ${texts.pg117_p033}`;
assert.equal((combined.match(/Blank in words\./g) || []).length, 5);
assert.equal((combined.match(/Blank in numerals\./g) || []).length, 7);
assert.match(combined, /1\. 1 over 2\. Blank in words\. 2\. Blank in numerals\. One-third\./);
assert.match(combined, /11\. Blank in numerals\. One-third\. 12\. Blank in numerals\. Two-thirds\./);

const expected = [
  ["pg117_p001", "pg117_p001_blank_prompts_clear.mp3", 52, 27.696],
  ["pg117_p020", "pg117_p020_blank_prompts_clear.mp3", 29, 17.688],
  ["pg117_p033", "pg117_p033_blank_prompts_clear.mp3", 5, 5.376],
];
for (const [id, filename, tokenCount, expectedDuration] of expected) {
  assert.equal(audios[id], filename);
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.equal(words.length, tokenCount, `${id} must time every spoken token`);
  for (let index = 0; index < words.length; index += 1) {
    assert.ok(words[index].end >= words[index].start, `${id} token ${index} must have a valid duration`);
    if (index) assert.ok(words[index].start >= words[index - 1].end, `${id} token ${index} must not overlap`);
  }
  const duration = Number(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
    `content/i18n/en-GB/audio/${audios[id]}`,
  ], { encoding: "utf8" }).trim());
  assert.ok(Math.abs(duration - expectedDuration) < 0.01, `${id} must use the revised narration audio`);
  assert.ok(words.at(-1).end <= duration, `${id} timing must fit its audio`);
}

assert.match(page, /read-aloud-highlight-bridge\.js\?v=82/);
assert.match(bridge, /function buildPage117Map/);
assert.match(bridge, /mapping\.length === narration\.length/);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
assert.equal(offline["./pg117_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
