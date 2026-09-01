import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg055_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const expected = "Table description. The addition chart has seven rows and seven columns. The first row and first column contain headings. The other cells contain sums or blank spaces. Rows are read from left to right.";
assert.equal(texts.pg055_im002, expected);
assert.equal(audios.pg055_im002, "pg055_im002_table_description.mp3");
const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(hash(audios.pg055_im002), "6207040eed77ae8be0b9f9415e727d9bb08e26911446ed1c0b58a745f4652f0d");

const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
const timed = timecodes.pg055_im002.timecodes[1].word_timestamps;
assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
assert.ok(timed.every(({ start, end }) => end - start >= 0.099));
assert.ok(timed.every(({ start, end }, index) => end <= 15.72 && (!index || start >= timed[index - 1].end)));

assert.ok(page.indexOf('data-id="pg055_p002"') < page.indexOf('data-id="pg055_im002"'));
assert.ok(page.indexOf('data-id="pg055_im002"') < page.indexOf('data-id="pg055_p041"'));
assert.equal((page.match(/data-id="pg055_im002"/g) || []).length, 1);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=112/);
assert.match(bridge, /sourceId === "pg055_im002"/);
assert.match(config.bundleVersion, /-pg055-table-description-1$/);
assert.doesNotMatch(expected, /\b(?:402|403|404|405|406|407|408|409|410|411|412)\b/, "the structural description must not supply chart answers");

assert.equal(hash("pg055_p001.mp3"), "7bc01bcb12b006fceaa74b0c2fdf89e9a2ded76551485422942446490b6736bd");
assert.equal(hash("pg055_p002.mp3"), "c13b65bd8a0659a794c0e0ca9ab8c64dae5200a869473d671c968fd7f9226d86");
assert.equal(hash("pg055_p041_adt_chart.mp3"), "761a773640aee3abeac2b0a3e54972ce049488e07f8257a6f6cfe212658627ef");
assert.equal(hash("pg055_p042_adt_questions.mp3"), "df2bbaf58743e1c5f32495f6fd1d4b97a39b16604842e4ac2421d5215e747f07");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg055_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 55 Exercise 9 now introduces its addition chart without supplying answers.");
