import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const narration = texts.pg144_p001.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
const words = timecodes.pg144_p001.timecodes[1].word_timestamps;
assert.deepEqual(words.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
assert.ok(words.every(({ start, end }) => end > start), "every narrated word must have a visible highlight interval");

assert.deepEqual(words[0], { text: "Exercise", start: 0, end: 0.72 });
assert.deepEqual(words[3], { text: "11", start: 2.88, end: 3.44 });
assert.deepEqual(words[9], { text: "12", start: 5.6, end: 6.06 });
assert.deepEqual(words[15], { text: "13", start: 8.44, end: 9 });
assert.deepEqual(words[21], { text: "14", start: 11.3, end: 11.86 });

const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(audios.pg144_p001, "pg144_p001_adt_natural.mp3");
assert.equal(hash(audios.pg144_p001), "49153050e0bee981461d0417f4bfaedb61ef23c641f02eff3887eb3bf1cafd6e");
assert.match(config.bundleVersion, /-pg144-highlight-timing-1$/);
assert.deepEqual(offline["./assets/config.json"], config);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 144 highlighting follows the unchanged audio timing.");
