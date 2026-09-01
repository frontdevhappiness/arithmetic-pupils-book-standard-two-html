import assert from "node:assert/strict";
import fs from "node:fs";

const texts = JSON.parse(fs.readFileSync("content/i18n/en-GB/texts.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const page = fs.readFileSync("pg138_sec001.html", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(texts.pg138_p020, "Questions. 1. What shape does the arrangement of players relate to? 2. What other game is similar to the game you played? 3. Which game has a rectangular arrangement? Exercise 3. 1. Draw a circle by tracing a 100 or 200 shillings coin. 2. Draw a triangle by tracing the shape of a triangular object.");
assert.equal(audios.pg138_p020, "pg138_p020_adt_natural.mp3");
assert.match(page, /<section class="pg138-card pg138-questions">[\s\S]*?<h1 class="pg138-banner">Questions<\/h1>/);
assert.match(page, /read-aloud-highlight-bridge\.js\?v=97/);
assert.match(bridge, /function buildPage138QuestionsHeadingMap/);
assert.match(bridge, /\.pg138-questions \.pg138-banner/);
assert.match(bridge, /mapping\[0\] = headingToken\.range/);
assert.equal(offline["./pg138_sec001.html"], page);
assert.equal(offline["./assets/read-aloud-highlight-bridge.js"], bridge);
