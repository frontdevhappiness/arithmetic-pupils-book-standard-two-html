import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg008_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const expected = "Table description. The table has five rows and ten columns. The first row contains 101 to 110. The second row contains 111 to 120. The third row contains 121 to 130. The fourth row contains 131 to 140. The fifth row contains 141 to 150. Rows are read from left to right.";
assert.equal(texts.pg008_p007, expected);
assert.equal(audios.pg008_p007, "pg008_p007_table_description.mp3");
assert.equal(createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${audios.pg008_p007}`)).digest("hex"), "03a27e51c014433e319b8c70e604e2ea4b9ed0354a84c98b6826e6b99d6f0999");

const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
const timed = timecodes.pg008_p007.timecodes[1].word_timestamps;
assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
assert.ok(timed.every(({ start, end }) => end > start));

assert.ok(page.indexOf('data-id="pg008_p006"') < page.indexOf('data-id="pg008_p007"'));
assert.ok(page.indexOf('data-id="pg008_p007"') < page.indexOf('data-id="pg008_p008"'));
assert.match(page, /data-id="pg008_p007"[\s\S]*<table class="number-table"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=101/);
assert.match(bridge, /sourceId === "pg008_p007"/);
assert.match(config.bundleVersion, /-pg008-table-description-1(?:-|$)/);

const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(hash("pg008_p005.mp3"), "97c3714bce7f47c98887318219637ea84167caf285905f33be2d393184459aeb");
assert.equal(hash("pg008_p006.mp3"), "6ee99fac167c5a9283e0e78e7f74c2e4ec9aad8f72ecbe4357e55aea00fe9f7a");
assert.equal(hash("pg008_p008.mp3"), "32f05df9f7790ec37c8d510eef52e69782d8f543c782b101810b323c4b6ef194");

assert.equal(offline["./pg008_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 8 Exercise 2 now introduces and describes its number table.");
