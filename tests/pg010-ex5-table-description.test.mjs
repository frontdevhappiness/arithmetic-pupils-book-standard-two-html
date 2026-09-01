import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg010_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const expected = "Table description. The table has ten rows and ten columns. The first row contains 301 to 310. The second row contains 311 to 320. The third row contains 321 to 330. The fourth row contains 331 to 340. The fifth row contains 341 to 350. The sixth row contains 351 to 360. The seventh row contains 361 to 370. The eighth row contains 371 to 380. The ninth row contains 381 to 390. The tenth row contains 391 to 400. Rows are read from left to right.";
assert.equal(texts.pg010_im002, expected);
assert.equal(audios.pg010_im002, "pg010_im002_table_description.mp3");
assert.equal(createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${audios.pg010_im002}`)).digest("hex"), "dba600bff84362470c97909cafc3f66b96f351bda0c4aa8065f2f39468093437");

const narration = expected.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || [];
const timed = timecodes.pg010_im002.timecodes[1].word_timestamps;
assert.deepEqual(timed.map(({ text }) => text.toLowerCase()), narration.map((word) => word.toLowerCase()));
assert.ok(timed.every(({ start, end }) => end - start >= 0.099));
assert.ok(timed.every(({ start, end }, index) => end <= 50.424 && (!index || start >= timed[index - 1].end)));

assert.ok(page.indexOf('data-id="pg010_p105"') < page.indexOf('data-id="pg010_im002"'));
assert.ok(page.indexOf('data-id="pg010_im002"') < page.indexOf('data-id="pg010_p107"'));
assert.match(page, /data-id="pg010_im002"[\s\S]*?<table class="number-table"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=104/);
assert.match(bridge, /sourceId === "pg010_im002"/);
assert.match(config.bundleVersion, /-pg010-ex5-table-description-1$/);

const hash = (filename) => createHash("sha256").update(fs.readFileSync(`content/i18n/en-GB/audio/${filename}`)).digest("hex");
assert.equal(hash("pg010_im001_table_description.mp3"), "e1613ae7d966ea6a02226b869bf287644714074c95b5408339044223b2bbe1b2");
assert.equal(hash("pg010_p104.mp3"), "2e604e74a0963339d7687f9a435f91243d24439606eaf8f0a90e98d09904ef37");
assert.equal(hash("pg010_p105.mp3"), "586272bab7b221cbd4c4266b119629394b085dcea1185b5bba0265ee8471398a");
assert.equal(hash("pg010_p107.mp3"), "44c97b6dd2554d176fc46efb17898e824287672042c80bc96b5076bfafc28ce1");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg010_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 10 Exercise 5 now introduces and describes its number table.");
