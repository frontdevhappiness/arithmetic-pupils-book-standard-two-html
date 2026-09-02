import assert from "node:assert/strict";
import fs from "node:fs";

const cover = fs.readFileSync("index.html", "utf8");
const pageOne = fs.readFileSync("pg001_sec001.html", "utf8");
const pages = JSON.parse(fs.readFileSync("content/pages.json", "utf8"));
const videos = JSON.parse(fs.readFileSync("content/i18n/en-GB/videos.json", "utf8"));
const offlineSource = fs.readFileSync("assets/offline-data.js", "utf8");
const prefix = "  var INLINE = ";
const start = offlineSource.indexOf(prefix) + prefix.length;
const end = offlineSource.indexOf(";\n  var BASE_DIR", start);
const offline = JSON.parse(offlineSource.slice(start, end));

assert.equal(pages.length, 145, "the unnumbered cover must precede all 144 numbered pages");
assert.deepEqual(pages[0], { section_id: "cover_sec001", href: "index.html" });
assert.deepEqual(pages[1], { section_id: "pg001_sec001", href: "pg001_sec001.html", page_number: 1 });
assert.equal(pages.at(-1).page_number, 144);
assert.equal(new Set(pages.slice(1).map(({ page_number }) => page_number)).size, 144, "numbered pages must remain unique");

assert.match(cover, /name="title-id" content="cover_sec001"/);
assert.match(cover, /name="page-section-id" content="0"/);
assert.match(cover, /current\.textContent = "Cover"/, "the internal zero marker must display as Cover in the reader dock");
assert.match(cover, /images\/arithmetic_std_2_front_cover\.png/);
assert.doesNotMatch(cover, /data-id="pg001_/);
assert.match(pageOne, /name="title-id" content="pg001_sec001"/);
assert.match(pageOne, /data-section-id="pg001_sec001"/);
assert.equal(videos["video-1"], "sl_pg001_sec001.mp4", "page 1 must retain its sign-language video mapping");
assert.ok(fs.statSync("images/arithmetic_std_2_front_cover.png").size > 0, "trimmed cover image must exist");

assert.equal(offline["./index.html"], cover);
assert.equal(offline["./pg001_sec001.html"], pageOne);
assert.deepEqual(offline["./content/pages.json"], pages);
