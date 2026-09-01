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

const expected = [
  ["pg122_p001", "pg122_p001_adt_natural.mp3", 128, 40.056],
  ["pg122_p012", "pg122_p012_adt_natural.mp3", 31, 13.368],
];

for (const [id, originalAudio, tokenCount, expectedDuration] of expected) {
  assert.equal(audios[id], originalAudio, `${id} must retain its original narration`);
  const words = timecodes[id].timecodes[1].word_timestamps;
  const narration = texts[id].match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  assert.equal(words.length, tokenCount);
  assert.deepEqual(words.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
  for (let index = 0; index < words.length; index += 1) {
    assert.ok(words[index].end > words[index].start, `${id} word ${index} must have a positive duration`);
    if (index) assert.ok(words[index].start >= words[index - 1].end, `${id} word ${index} must not overlap`);
  }
  const duration = Number(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
    `content/i18n/en-GB/audio/${originalAudio}`,
  ], { encoding: "utf8" }).trim());
  assert.ok(Math.abs(duration - expectedDuration) < 0.01);
  assert.ok(words.at(-1).end <= duration);
}

const questions = timecodes.pg122_p001.timecodes[1].word_timestamps;
assert.deepEqual(questions.find(({ text }) => text === "Questions"), { text: "Questions", start: 13.6, end: 14 });
assert.deepEqual(questions.find(({ text }, index) => text === "1" && index > 40), { text: "1", start: 14.56, end: 14.8 });
assert.deepEqual(questions.at(-1), { text: "office", start: 39.34, end: 39.66 });
assert.deepEqual(timecodes.pg122_p012.timecodes[1].word_timestamps.at(-1), { text: "height", start: 12.9, end: 13.16 });

assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);
