import assert from "node:assert/strict";
import fs from "node:fs";

const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const css = fs.readFileSync("assets/fonts.css", "utf8");
const bridge = fs.readFileSync("assets/read-aloud-highlight-bridge.js", "utf8");
const pageManifest = JSON.parse(fs.readFileSync("content/pages.json", "utf8"));
const audios = JSON.parse(fs.readFileSync("content/i18n/en-GB/audios.json", "utf8"));
const timecodes = JSON.parse(fs.readFileSync("content/i18n/en-GB/timecode/timecode_output.json", "utf8"));

assert.equal(config.features.highlight, true, "word highlighting must be enabled in the book configuration");
assert.doesNotMatch(css, /Word highlighting is temporarily disabled book-wide/);
assert.doesNotMatch(css, /html body \[id\^='adt-pg'\]\[id\$='-word-highlight'\]/);
assert.match(bridge, /MutationObserver/);
assert.match(bridge, /adt-visible-narration-highlight/);
assert.match(bridge, /background:#fde047/);
assert.match(bridge, /::highlight\(/);
assert.match(bridge, /CSS\.highlights\.set/);
assert.match(bridge, /alignTokens/);
assert.match(bridge, /pg142_sec001/);
assert.match(bridge, /buildPage94ShareMap/);
assert.match(bridge, /buildPage23TableMap/);
assert.match(bridge, /buildPage24AnswerBlankMap/);
assert.match(bridge, /buildPage28ExerciseRowMap/);
assert.match(bridge, /buildPage29ExerciseDiagramMap/);
assert.match(bridge, /samePassage/);

let hiddenNarrationPages = 0;
for (const { href } of pageManifest) {
  const html = fs.readFileSync(href, "utf8");
  assert.match(html, /assets\/fonts\.css\?v=2/, `${href} must request the restored highlight CSS`);
  assert.match(
    html,
    href === "pg045_sec001.html"
      ? /assets\/read-aloud-highlight-bridge\.js\?v=24/
      : href === "pg046_sec001.html"
        ? /assets\/read-aloud-highlight-bridge\.js\?v=28/
        : href === "pg047_sec001.html"
          ? /assets\/read-aloud-highlight-bridge\.js\?v=29/
          : href === "pg048_sec001.html"
            ? /assets\/read-aloud-highlight-bridge\.js\?v=33/
            : href === "pg049_sec001.html"
              ? /assets\/read-aloud-highlight-bridge\.js\?v=35/
              : href === "pg050_sec001.html"
                ? /assets\/read-aloud-highlight-bridge\.js\?v=36/
                : href === "pg051_sec001.html"
                  ? /assets\/read-aloud-highlight-bridge\.js\?v=39/
                  : href === "pg052_sec001.html"
                    ? /assets\/read-aloud-highlight-bridge\.js\?v=40/
                    : href === "pg053_sec001.html"
                      ? /assets\/read-aloud-highlight-bridge\.js\?v=42/
                      : href === "pg054_sec001.html"
                        ? /assets\/read-aloud-highlight-bridge\.js\?v=43/
                        : href === "pg055_sec001.html"
                          ? /assets\/read-aloud-highlight-bridge\.js\?v=45/
                          : href === "pg056_sec001.html"
                            ? /assets\/read-aloud-highlight-bridge\.js\?v=46/
                            : href === "pg057_sec001.html"
                              ? /assets\/read-aloud-highlight-bridge\.js\?v=49/
                              : href === "pg058_sec001.html"
                                ? /assets\/read-aloud-highlight-bridge\.js\?v=50/
                                : href === "pg059_sec001.html"
                                  ? /assets\/read-aloud-highlight-bridge\.js\?v=51/
                                  : href === "pg060_sec001.html"
                                    ? /assets\/read-aloud-highlight-bridge\.js\?v=52/
                                    : href === "pg063_sec001.html"
                                      ? /assets\/read-aloud-highlight-bridge\.js\?v=54/
                                      : href === "pg064_sec001.html"
                                        ? /assets\/read-aloud-highlight-bridge\.js\?v=55/
                                        : href === "pg065_sec001.html"
                                          ? /assets\/read-aloud-highlight-bridge\.js\?v=56/
            : /assets\/read-aloud-highlight-bridge\.js\?v=23/,
    `${href} must load the non-layout-changing highlight bridge`,
  );
  if (/class=["'][^"']*\bsr-only\b[^"']*["'][^>]*data-id=["']pg\d{3}_[^"']+["']/i.test(html)) {
    hiddenNarrationPages += 1;
  }
}

assert.ok(hiddenNarrationPages > 0, "the bridge must cover rebuilt pages with hidden narration sources");

let audioEntries = 0;
for (const id of Object.keys(audios)) {
  if (!/^pg\d{3}_/.test(id)) continue;
  audioEntries += 1;
  const slots = Object.values(timecodes[id]?.timecodes ?? {});
  assert.ok(
    slots.some((slot) => slot && Array.isArray(slot.word_timestamps) && slot.word_timestamps.length > 0),
    `${id} must retain precise word timestamps`,
  );
}

console.log(
  `Highlighting enabled across ${pageManifest.length} pages; ${audioEntries} narrated entries retain word timing.`,
);
