import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg013_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const descriptions = {
  pg013_im001: "Table description. The table has eleven rows and eleven columns. The first row contains 886 to 896. The second row contains 897 to 907. The third row contains 908 to 918. The fourth row contains 919 to 929. The fifth row contains 930 to 940. The sixth row contains 941 to 951. The seventh row contains 952 to 962. The eighth row contains 963 to 973. The ninth row contains 974 to 984. The tenth row contains 985 to 995. The eleventh row contains nine hundred and ninety-six to nine hundred and ninety-nine, followed by seven empty cells. Rows are read from left to right.",
  pg013_im002: "Table description. The table has nine rows and ten columns. The first row contains 100 to 190. The second row contains 200 to 290. The third row contains 300 to 390. The fourth row contains 400 to 490. The fifth row contains 500 to 590. The sixth row contains 600 to 690. The seventh row contains 700 to 790. The eighth row contains 800 to 890. The ninth row contains 900 to 990. Rows are read from left to right.",
};
const expectedAudio = {
  pg013_im001: ["pg013_im001_table_description.mp3", "a410d2c7e9375f807c624e2f4f91cbdab9cd511c3888c8623a89d02413a77f7c", 59.208],
  pg013_im002: ["pg013_im002_table_description.mp3", "92aaefc99d77984f0436d694f199ae99ea23d28e7b29739fa8efc881bed32c16", 41.688],
};
const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");

for (const [id, expected] of Object.entries(descriptions)) {
  const [filename, expectedHash, duration] = expectedAudio[id];
  assert.equal(texts[id], expected);
  assert.equal(audios[id], filename);
  assert.equal(hash(filename), expectedHash);
  const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
  const timed = timecodes[id].timecodes[1].word_timestamps;
  assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
  assert.ok(timed.every(({ start, end }) => end - start >= 0.099));
  assert.ok(timed.every(({ start, end }, index) => end <= duration && (!index || start >= timed[index - 1].end)));
  assert.match(bridge, new RegExp(`sourceId === "${id}"`));
}

assert.ok(page.indexOf('data-id="pg013_im001"') < page.indexOf('data-id="pg013_p001"'));
assert.ok(page.indexOf('data-id="pg013_p013"') < page.indexOf('data-id="pg013_im002"'));
assert.ok(page.indexOf('data-id="pg013_im002"') < page.indexOf('data-id="pg013_p014"'));
assert.match(page, /data-id="pg013_im001"[\s\S]*?<table class="number-table continuation-table"/);
assert.match(page, /data-id="pg013_im002"[\s\S]*?<table class="number-table tens-table"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=109/);
assert.match(config.bundleVersion, /-pg013-table-descriptions-1(?:-|$)/);
assert.match(config.bundleVersion, /-pg013-remove-in-tens-1(?:-|$)/);
assert.match(config.bundleVersion, /-pg013-final-row-pronunciation-1(?:-|$)/);

assert.equal(hash("pg013_p001.mp3"), "c80663590a8e2980bf5c038880dcf617f8a7dc08e54897e67cf0ceb5f5318e62");
assert.equal(hash("pg013_p011.mp3"), "ae3384432d4bf00f9673583f81106ecfb616e51570f5f0850512a5e4e1ce634b");
assert.equal(hash("pg013_p012.mp3"), "f3a3c99b63f7a6f800608b5ffdb6fd4912c255fe295bf1cc29011e99e254751b");
assert.equal(hash("pg013_p013.mp3"), "e8f6cf7bdb69521cdf7aa8c58de67bfd57cf2d014f7c9393f21603306e90c6bb");
assert.equal(hash("pg013_p014.mp3"), "a685dd35e2c5a8bc44f3d4969a8b45a6365a5cd5e0b21c1bfd1172770bf62619");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg013_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 13 Exercise 9 continuation and Exercise 10 now introduce and describe their tables.");
