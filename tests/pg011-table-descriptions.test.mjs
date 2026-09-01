import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg011_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const descriptions = {
  pg011_im001: "Table description. The table has ten rows and ten columns. The first row contains 401 to 410. The second row contains 411 to 420. The third row contains 421 to 430. The fourth row contains 431 to 440. The fifth row contains 441 to 450. The sixth row contains 451 to 460. The seventh row contains 461 to 470. The eighth row contains 471 to 480. The ninth row contains 481 to 490. The tenth row contains 491 to 500. Rows are read from left to right.",
  pg011_im002: "Table description. The table has fifteen rows and eleven columns. The first row contains 501 to 511. The second row contains 512 to 522. The third row contains 523 to 533. The fourth row contains 534 to 544. The fifth row contains 545 to 555. The sixth row contains 556 to 566. The seventh row contains 567 to 577. The eighth row contains 578 to 588. The ninth row contains 589 to 599. The tenth row contains 600 to 610. The eleventh row contains 611 to 621. The twelfth row contains 622 to 632. The thirteenth row contains 633 to 643. The fourteenth row contains 644 to 654. The fifteenth row contains 655 to 665. Rows are read from left to right.",
};
const expectedAudio = {
  pg011_im001: ["pg011_im001_table_description.mp3", "058962c7faef7091754ad0dab93ea91679f77ec109d692307b546b8de6b506d2", 49.152],
  pg011_im002: ["pg011_im002_table_description.mp3", "6e4de4a4712e168fc17c741e4b465a26aafc73a741c2879fc64dd4c75849a0d8", 74.04],
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

assert.ok(page.indexOf('data-id="pg011_p003"') < page.indexOf('data-id="pg011_im001"'));
assert.ok(page.indexOf('data-id="pg011_im001"') < page.indexOf('data-id="pg011_p004"'));
assert.ok(page.indexOf('data-id="pg011_p105"') < page.indexOf('data-id="pg011_im002"'));
assert.ok(page.indexOf('data-id="pg011_im002"') < page.indexOf('data-id="pg011_p107"'));
assert.match(page, /data-id="pg011_im001"[\s\S]*?<table class="number-table"/);
assert.match(page, /data-id="pg011_im002"[\s\S]*?<table class="number-table extended"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=105/);
assert.match(config.bundleVersion, /-pg011-table-descriptions-1(?:-|$)/);

assert.equal(hash("pg011_p001.mp3"), "2b7df2ebbfc3f04590cbe224b6f9c87bce7013525a6bb589637fe0c141ff37eb");
assert.equal(hash("pg011_p003.mp3"), "cbba7254cc0670a3681fe1e587db1f8caa6fa63c260b229997acb4587d105230");
assert.equal(hash("pg011_p004.mp3"), "be58be417fcf021ae170ca688a05e7115ee78a450b37c6a0e600cb9f4cab761d");
assert.equal(hash("pg011_p104.mp3"), "083d695c3d3ed537be2e0a4ceea8e9ce817b28b1eeb911835668ea51be123c1f");
assert.equal(hash("pg011_p105.mp3"), "2d14c0632c72de96904e6d1725e50317435903c13bcd15cfdd411e0fa36878f3");
assert.equal(hash("pg011_p107.mp3"), "d9c3fb785ad7142a2681a756969c9c901043af53df0f28866aa7525754883479");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg011_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 11 Exercises 6 and 7 now introduce and describe their number tables.");
