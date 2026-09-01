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
assert.match(bridge, /buildPage85Map/);
assert.match(bridge, /buildPage86ExerciseMap/);
assert.match(bridge, /buildPage87Map/);
assert.match(bridge, /buildPage88Map/);
assert.match(bridge, /buildPage89Map/);
assert.match(bridge, /buildPage90Map/);
assert.match(bridge, /buildPage91Map/);
assert.match(bridge, /buildPage92Map/);
assert.match(bridge, /buildPage93Map/);
assert.match(bridge, /buildPage95Map/);
assert.match(bridge, /buildPage96Map/);
assert.match(bridge, /buildPage97Map/);
assert.match(bridge, /buildPage98Map/);
assert.match(bridge, /buildPage99Map/);
assert.match(bridge, /buildPage100Map/);
assert.match(bridge, /buildPage101Map/);
assert.match(bridge, /buildPage102Map/);
assert.match(bridge, /buildPage103Map/);
assert.match(bridge, /buildPage104Map/);
assert.match(bridge, /buildPage105Map/);
assert.match(bridge, /buildPage106Map/);
assert.match(bridge, /buildPage107Map/);
assert.match(bridge, /buildPage108Map/);
assert.match(bridge, /buildPage109Map/);
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
                                          : href === "pg071_sec001.html"
                                            ? /assets\/read-aloud-highlight-bridge\.js\?v=26/
                                            : href === "pg072_sec001.html"
                                              ? /assets\/read-aloud-highlight-bridge\.js\?v=26/
                                              : href === "pg073_sec001.html"
                                                ? /assets\/read-aloud-highlight-bridge\.js\?v=27/
                                                : href === "pg074_sec001.html"
                                                  ? /assets\/read-aloud-highlight-bridge\.js\?v=28/
                                                  : href === "pg075_sec001.html"
                                                    ? /assets\/read-aloud-highlight-bridge\.js\?v=29/
                                                    : href === "pg076_sec001.html"
                                                      ? /assets\/read-aloud-highlight-bridge\.js\?v=30/
                                                      : href === "pg077_sec001.html"
                                                        ? /assets\/read-aloud-highlight-bridge\.js\?v=31/
                                                        : href === "pg078_sec001.html"
                                                          ? /assets\/read-aloud-highlight-bridge\.js\?v=32/
                                                          : href === "pg079_sec001.html"
                                                            ? /assets\/read-aloud-highlight-bridge\.js\?v=33/
                                                            : href === "pg080_sec001.html"
                                                              ? /assets\/read-aloud-highlight-bridge\.js\?v=35/
                                                              : href === "pg081_sec001.html"
                                                                ? /assets\/read-aloud-highlight-bridge\.js\?v=36/
                                                                : href === "pg082_sec001.html"
                                                                  ? /assets\/read-aloud-highlight-bridge\.js\?v=41/
                                                                  : href === "pg083_sec001.html"
                                                                    ? /assets\/read-aloud-highlight-bridge\.js\?v=42/
                                                                    : href === "pg084_sec001.html"
                                                                      ? /assets\/read-aloud-highlight-bridge\.js\?v=45/
                                                                      : href === "pg085_sec001.html"
                                                                        ? /assets\/read-aloud-highlight-bridge\.js\?v=46/
                                                                        : href === "pg086_sec001.html"
                                                                          ? /assets\/read-aloud-highlight-bridge\.js\?v=47/
                                                                          : href === "pg087_sec001.html"
                                                                            ? /assets\/read-aloud-highlight-bridge\.js\?v=48/
                                                                            : href === "pg088_sec001.html"
                                                                              ? /assets\/read-aloud-highlight-bridge\.js\?v=49/
                                                                              : href === "pg089_sec001.html"
                                                                                ? /assets\/read-aloud-highlight-bridge\.js\?v=50/
                                                                                : href === "pg090_sec001.html"
                                                                                  ? /assets\/read-aloud-highlight-bridge\.js\?v=51/
                                                                                  : href === "pg091_sec001.html"
                                                                                    ? /assets\/read-aloud-highlight-bridge\.js\?v=52/
                                                                                    : href === "pg092_sec001.html"
                                                                                      ? /assets\/read-aloud-highlight-bridge\.js\?v=53/
                                                                                      : href === "pg093_sec001.html"
                                                                                        ? /assets\/read-aloud-highlight-bridge\.js\?v=55/
                                                                                        : href === "pg095_sec001.html"
                                                                                          ? /assets\/read-aloud-highlight-bridge\.js\?v=56/
                                                                                          : href === "pg096_sec001.html"
                                                                                            ? /assets\/read-aloud-highlight-bridge\.js\?v=57/
                                                                                            : href === "pg097_sec001.html"
                                                                                              ? /assets\/read-aloud-highlight-bridge\.js\?v=58/
                                                                                              : href === "pg098_sec001.html"
                                                                                                ? /assets\/read-aloud-highlight-bridge\.js\?v=59/
                                                                                                : href === "pg099_sec001.html"
                                                                                                  ? /assets\/read-aloud-highlight-bridge\.js\?v=61/
                                                                                                  : href === "pg100_sec001.html"
                                                                                                    ? /assets\/read-aloud-highlight-bridge\.js\?v=62/
                                                                                                    : href === "pg101_sec001.html"
                                                                                                      ? /assets\/read-aloud-highlight-bridge\.js\?v=63/
                                                                                                      : href === "pg102_sec001.html"
                                                                                                        ? /assets\/read-aloud-highlight-bridge\.js\?v=64/
                                                                                                        : href === "pg103_sec001.html"
                                                                                                          ? /assets\/read-aloud-highlight-bridge\.js\?v=65/
                                                                                                          : href === "pg104_sec001.html"
                                                                                                            ? /assets\/read-aloud-highlight-bridge\.js\?v=66/
                                                                                                            : href === "pg105_sec001.html"
                                                                                                              ? /assets\/read-aloud-highlight-bridge\.js\?v=70/
                                                                                                              : href === "pg106_sec001.html"
                                                                                                                ? /assets\/read-aloud-highlight-bridge\.js\?v=69/
                                                                                                                : href === "pg107_sec001.html"
                                                                                                                  ? /assets\/read-aloud-highlight-bridge\.js\?v=71/
                                                                                                                  : href === "pg108_sec001.html"
                                                                                                                    ? /assets\/read-aloud-highlight-bridge\.js\?v=72/
                                                                                                                    : href === "pg109_sec001.html"
                                                                                                                      ? /assets\/read-aloud-highlight-bridge\.js\?v=74/
                                                                                                                      : href === "pg110_sec001.html"
                                                                                                                        ? /assets\/read-aloud-highlight-bridge\.js\?v=77/
                                                                                                                        : href === "pg111_sec001.html"
                                                                                                                          ? /assets\/read-aloud-highlight-bridge\.js\?v=78/
                                                                                                                          : href === "pg113_sec001.html"
                                                                                                                            ? /assets\/read-aloud-highlight-bridge\.js\?v=79/
                                                                                                                            : href === "pg114_sec001.html"
                                                                                                                              ? /assets\/read-aloud-highlight-bridge\.js\?v=80/
                                                                                                                              : href === "pg115_sec001.html"
                                                                                                                                ? /assets\/read-aloud-highlight-bridge\.js\?v=81/
                                                                                                                                : href === "pg117_sec001.html"
                                                                                                                                  ? /assets\/read-aloud-highlight-bridge\.js\?v=82/
                                                                                                                                  : href === "pg118_sec001.html"
                                                                                                                                    ? /assets\/read-aloud-highlight-bridge\.js\?v=83/
                                                                                                                                    : href === "pg119_sec001.html"
                                                                                                                                      ? /assets\/read-aloud-highlight-bridge\.js\?v=84/
            : /assets\/read-aloud-highlight-bridge\.js\?v=23/,
    `${href} must load the non-layout-changing highlight bridge`,
  );
  if (/class=["'][^"']*\bsr-only\b[^"']*["'][^>]*data-id=["']pg\d{3}_[^"']+["']/i.test(html)) {
    hiddenNarrationPages += 1;
  }
}

assert.ok(hiddenNarrationPages > 0, "the bridge must cover rebuilt pages with hidden narration sources");
assert.match(
  fs.readFileSync("pg085_sec001.html", "utf8"),
  /class="adt-source-hooks sr-only"/,
  "page 85 narration hooks must be recognized as hidden highlight sources",
);
assert.match(
  fs.readFileSync("pg087_sec001.html", "utf8"),
  /class="adt-source-hooks sr-only"/,
  "page 87 narration hooks must be recognized as hidden highlight sources",
);
assert.match(
  fs.readFileSync("pg088_sec001.html", "utf8"),
  /class="source-hooks sr-only"/,
  "page 88 narration hooks must be recognized as hidden highlight sources",
);
assert.match(
  fs.readFileSync("pg089_sec001.html", "utf8"),
  /class="adt-source-hooks sr-only"/,
  "page 89 narration hooks must be recognized as hidden highlight sources",
);
assert.match(
  fs.readFileSync("pg090_sec001.html", "utf8"),
  /class="pg090-source-hooks sr-only"/,
  "page 90 narration hooks must be recognized as hidden highlight sources",
);

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
