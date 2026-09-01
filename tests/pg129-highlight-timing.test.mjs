import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(audios.pg129_p001, "pg129_p001_adt_natural.mp3", "page 129 must retain its original narration");
const words = timecodes.pg129_p001.timecodes[1].word_timestamps;
const narration = texts.pg129_p001.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
assert.equal(words.length, 39);
assert.deepEqual(words.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));

for (let index = 0; index < words.length; index += 1) {
  assert.ok(words[index].end > words[index].start, `word ${index} must have a positive duration`);
  if (index) assert.ok(words[index].start >= words[index - 1].end, `word ${index} must not overlap`);
}

const duration = Number(execFileSync("ffprobe", [
  "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
  "content/i18n/en-GB/audio/pg129_p001_adt_natural.mp3",
], { encoding: "utf8" }).trim());
assert.ok(Math.abs(duration - 19.104) < 0.01);
assert.ok(words.at(-1).end <= duration);

assert.deepEqual(words[0], { text: "Recognizing", start: 0, end: 0.96 });
assert.deepEqual(words[1], { text: "non-standard", start: 0.96, end: 1.88 });
assert.deepEqual(words[7], { text: "following", start: 4.68, end: 4.98 });
assert.deepEqual(words[23], { text: "show", start: 12.98, end: 13.34 });
assert.deepEqual(words.at(-1), { text: "grain", start: 18.62, end: 19 });
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
