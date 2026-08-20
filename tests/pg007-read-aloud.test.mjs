import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));
const tokens = (text) => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
const normal = (word) => word.toLocaleLowerCase("en-GB");

const html = read("pg007_sec001.html");
const runtime = read("assets/base.bundle.local.js");
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");

const spokenOrder = [
  "pg007_p023", "pg007_p024", "pg007_p021", "pg007_p001", "pg007_p002",
  "pg007_p005", "pg007_p006", "pg007_p007", "pg007_p008", "pg007_p011",
  "pg007_p012", "pg007_p013", "pg007_p016", "pg007_p017", "pg007_p018"
];

// Reproduce the page's pre-runtime DOM reorder, then verify the runtime will gather
// all non-image narration exactly once in the intended visual/reading order.
const pageMarkup = html.split("</main>", 1)[0];
const domIds = [...pageMarkup.matchAll(/data-id="(pg007_[^"]+)"/g)].map((match) => match[1]);
for (const id of ["pg007_p023", "pg007_p024", "pg007_p021"]) {
  domIds.splice(domIds.indexOf(id), 1);
  domIds.splice(domIds.indexOf("pg007_p001"), 0, id);
}
const gathered = domIds.filter((id) => audios[id] && !id.includes("_im"));
assert.deepEqual(gathered, spokenOrder, "narration order must follow the visible page");
assert.equal(new Set(gathered).size, gathered.length, "no passage may play twice");

for (const id of [...spokenOrder, "pg007_im001"]) {
  assert.ok(html.includes(`data-id="${id}"`), `${id} must be displayed`);
  assert.ok(audios[id], `${id} must have mapped narration audio`);
  const audioPath = `content/i18n/en-GB/audio/${audios[id]}`;
  const words = tokens(texts[id]);
  const stamps = timecodes[id]?.timecodes?.[1]?.word_timestamps;
  assert.ok(Array.isArray(stamps), `${id} must have word-level timestamps`);
  assert.deepEqual(stamps.map(({ text }) => normal(text)), words.map(normal), `${id} timestamp words must match every displayed word`);

  let previousEnd = 0;
  for (const [index, stamp] of stamps.entries()) {
    assert.ok(Number.isFinite(stamp.start) && Number.isFinite(stamp.end), `${id} word ${index} timing must be finite`);
    assert.ok(stamp.end > stamp.start, `${id} word ${index} must have visible positive duration`);
    assert.ok(stamp.start >= previousEnd - 1e-6, `${id} word ${index} must not overlap the prior word`);
    previousEnd = stamp.end;
  }

  const probe = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1",
    new URL(`../${audioPath}`, import.meta.url).pathname
  ], { encoding: "utf8" });
  const duration = Number(probe.stdout.trim());
  assert.ok(Number.isFinite(duration), `${id} audio duration must be readable by ffprobe`);
  assert.ok(previousEnd <= duration + 0.05, `${id} timestamps must fit its real audio duration`);
}

const hash = (filename) => createHash("sha256").update(readFileSync(new URL(`../content/i18n/en-GB/audio/${filename}`, import.meta.url))).digest("hex");
for (const ids of [["pg007_p006", "pg007_p011", "pg007_p016"], ["pg007_p007", "pg007_p012", "pg007_p017"]]) {
  assert.equal(new Set(ids.map((id) => hash(audios[id]))).size, 1, `${ids.join(", ")} repeated verses must use identical audio`);
  assert.deepEqual(ids.slice(1).map((id) => timecodes[id]), ids.slice(1).map(() => timecodes[ids[0]]), "identical audio must use identical timings");
}

// Regression checks for media-clock synchronization and stale-session cleanup.
assert.match(runtime, /audio\.currentTime/, "highlighting must use the audio media clock");
assert.match(runtime, /requestAnimationFrame\(tick\)/, "short words must be sampled every animation frame");
assert.match(runtime, /if \(prev === target\) return/, "the same spoken word must not be repainted repeatedly");
assert.match(runtime, /session !== playSessionRef\.current/, "old playback sessions must be ignored");
assert.match(runtime, /cancelAnimationFrame\(highlightFrameRef\.current\)/, "old highlight loops must be cancelled");
for (const handler of ["ontimeupdate", "onloadedmetadata", "onseeking", "onseeked", "onplaying", "onwaiting", "onended", "onerror"]) {
  assert.match(runtime, new RegExp(`audio\\.${handler} = null`), `${handler} must be detached before new playback`);
}
assert.match(runtime, /audio\.playbackRate = speedRef\.current/, "playback speed must stay on the same media clock");

// The page marker is a separate, fixed layer, so its exact measured bounds cannot
// reflow or overlap the book text.
assert.match(html, /#adt-pg007-word-highlight\{position:fixed;/);
assert.match(html, /marker\.style\.width = rect\.width \+ "px"/);
assert.match(html, /var height = Number\.isFinite\(lineHeight\) \? lineHeight \* scaleY : rect\.height/);
assert.match(html, /fontSize \* scaleY \* 0\.2/, "the marker must align with the photographed text baseline");
assert.match(html, /marker\.style\.height = height \+ "px"/);
assert.match(html, /span\[data-word-index\]\.bg-yellow-300::before\{content:none!important\}/);
assert.doesNotMatch(html, /transition:[^;}]*\b(?:left|top|width|height)\b/, "marker geometry must never lag behind the spoken word");

console.log(`pg007 read-aloud regression: ${spokenOrder.length} passages and ${spokenOrder.reduce((sum, id) => sum + tokens(texts[id]).length, 0)} spoken words verified`);
