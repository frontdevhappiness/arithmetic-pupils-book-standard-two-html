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

function narrationWords(id) {
  return texts[id].match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
}

for (const id of ["pg143_p001", "pg143_p017"]) {
  const words = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(words.map(({ text }) => text.toLowerCase()), narrationWords(id).map((word) => word.toLowerCase()));
  assert.ok(words.every(({ start, end }) => end > start), `${id} must give every word a visible interval`);
}

const first = timecodes.pg143_p001.timecodes[1].word_timestamps;
assert.deepEqual(first[0], { text: "Exercise", start: 0, end: 0.94 });
assert.deepEqual(first[8], { text: "1", start: 4.64, end: 4.96 });
assert.deepEqual(first[19], { text: "parallelogram", start: 8.22, end: 8.96 });
assert.deepEqual(first[50], { text: "8", start: 20.84, end: 21.16 });

const continuation = timecodes.pg143_p017.timecodes[1].word_timestamps;
assert.deepEqual(continuation[0], { text: "9", start: 0, end: 0.76 });
assert.deepEqual(continuation[6], { text: "10", start: 3.68, end: 4.08 });

const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(audios.pg143_p001, "pg143_p001_adt_natural.mp3");
assert.equal(audios.pg143_p017, "pg143_p017_adt_natural.mp3");
assert.equal(hash(audios.pg143_p001), "bcacb1d0927ec75188525e1622a3a5a544c9c482cec101e3e1ab7be2d067b0e4");
assert.equal(hash(audios.pg143_p017), "d4ad4ea31f1c26aaceaa100cc62baf3c8a9f68d6a2c71aae4df101ddd542337b");
assert.match(config.bundleVersion, /-pg143-highlight-timing-1$/);
assert.deepEqual(offline["./assets/config.json"], config);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 143 highlighting follows the unchanged audio timing.");
