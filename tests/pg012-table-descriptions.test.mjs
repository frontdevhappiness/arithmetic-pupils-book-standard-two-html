import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));
const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const page = fs.readFileSync("pg012_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

const descriptions = {
  pg012_im001: "Table description. The table has fifteen rows and eleven columns. The first row contains 666 to 676. The second row contains 677 to 687. The third row contains 688 to 698. The fourth row contains 699 to 709. The fifth row contains 710 to 720. The sixth row contains 721 to 731. The seventh row contains 732 to 742. The eighth row contains 743 to 753. The ninth row contains 754 to 764. The tenth row contains 765 to 775. The eleventh row contains 776 to 786. The twelfth row contains 787 to 797. The thirteenth row contains 798 to 808. The fourteenth row contains 809 to 819. The fifteenth row contains 820 to 830. Rows are read from left to right.",
  pg012_im002: "Table description. The table has five rows and eleven columns. The first row contains 831 to 841. The second row contains 842 to 852. The third row contains 853 to 863. The fourth row contains 864 to 874. The fifth row contains 875 to 885. Rows are read from left to right.",
};
const expectedAudio = {
  pg012_im001: ["pg012_im001_table_description.mp3", "e5e4cb79121fc9bb90bfeaec8fed1c3bb006ea454b65c6b32f5a3c418a212d55", 76.416],
  pg012_im002: ["pg012_im002_table_description.mp3", "83370c346956485c139b2088ead89d8e574b3354c70e7c577b01253d5a440534", 30.576],
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

assert.ok(page.indexOf('data-id="pg012_p002"') < page.indexOf('data-id="pg012_im001"'));
assert.ok(page.indexOf('data-id="pg012_im001"') < page.indexOf('data-id="pg012_p004"'));
assert.ok(page.indexOf('data-id="pg012_p020"') < page.indexOf('data-id="pg012_im002"'));
assert.ok(page.indexOf('data-id="pg012_im002"') < page.indexOf('data-id="pg012_p022"'));
assert.match(page, /data-id="pg012_im001"[\s\S]*?<table class="number-table"/);
assert.match(page, /data-id="pg012_im002"[\s\S]*?<table class="number-table"/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=106/);
assert.match(config.bundleVersion, /-pg012-table-descriptions-1$/);

assert.equal(hash("pg012_p001.mp3"), "d7a2d7921fcee307a52bd218d45f7bbcbd8aef4c77aedea37dbcfd604cc50857");
assert.equal(hash("pg012_p002.mp3"), "ce9916e23d604b5f814abb4ce13979e0fd0683a0df2095c21691d8a15618b741");
assert.equal(hash("pg012_p004.mp3"), "afbe1d79617e2683182647fb903e3a5eec3ab5d25a827e061b4364a2c1100c4e");
assert.equal(hash("pg012_p019.mp3"), "7bc01bcb12b006fceaa74b0c2fdf89e9a2ded76551485422942446490b6736bd");
assert.equal(hash("pg012_p020.mp3"), "f3a0f0e0108545c206078e094dc147a6795393fc8d137f02e1072f7983b5ba8d");
assert.equal(hash("pg012_p022.mp3"), "86832cc534a2d230dd90c86ce7bcc0b5fc3e5c0c73f09ec5c8dc32b6202adc75");

assert.deepEqual(offline["./assets/config.json"], config);
assert.equal(offline["./pg012_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
assert.deepEqual(offline["./content/i18n/en-GB/texts.json"], texts);
assert.deepEqual(offline["./content/i18n/en-GB/audios.json"], audios);
assert.deepEqual(offline["./content/i18n/en-GB/timecode/timecode_output.json"], timecodes);

console.log("Page 12 Exercises 8 and 9 now introduce and describe their number tables.");
