import assert from "node:assert/strict";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const page = fs.readFileSync("pg136_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(texts.pg136_p012, "Exercise 2. Study the following figures and answer the questions that follow. The labelled figures are: a, a yellow triangle; b, a purple diamond; c, a green circle; d, a blue octagon; e, a yellow triangle; f, a purple kite; g, a red square; h, a green oval; and i, an orange rectangle.");
assert.equal(audios.pg136_p012, "pg136_p012_adt_natural.mp3");
assert.match(page, /<h2 class="pg136-label">Exercise 2<\/h2>/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=94/);
assert.match(bridge, /function buildPage136Exercise2HeadingMap/);
assert.match(bridge, /\.pg136-card-two \.pg136-label/);
assert.match(bridge, /headingTokens\.forEach/);
assert.equal(offline["./pg136_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
