import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const page = fs.readFileSync(path.join(root, "pg027_sec001.html"), "utf8");
const bridge = fs.readFileSync(path.join(root, "assets/read-aloud-highlight-bridge.js"), "utf8");
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const exerciseIds = ["pg027_p007", "pg027_p008", ...Array.from({ length: 19 }, (_, index) => `pg027_p${String(index + 10).padStart(3, "0")}`)];
const rowIds = ["pg027_p011", "pg027_p013", "pg027_p015", "pg027_p017", "pg027_p019", "pg027_p021", "pg027_p023", "pg027_p025", "pg027_p027", "pg027_p028"];
const questionNumberIds = ["pg027_p010", "pg027_p012", "pg027_p014", "pg027_p016", "pg027_p018", "pg027_p020", "pg027_p022", "pg027_p024", "pg027_p026"];

test("all Exercise 2 passages use the ElimuNeural audio", () => {
  for (const id of exerciseIds) {
    assert.equal(audios[id], `${id}_elimu_neural.mp3`);
    assert.ok(fs.statSync(path.join(root, "content/i18n/en-GB/audio", audios[id])).size > 7_000);
    const stamps = timecodes[id]?.timecodes?.[1]?.word_timestamps;
    assert.ok(stamps?.length, `${id} must have word timings`);
    assert.ok(stamps.every((stamp, index) => stamp.start >= 0 && stamp.end > stamp.start && (!index || stamp.start >= stamps[index - 1].end)));
  }
});

test("the ten items say blank once for each of their three answer lines", () => {
  let spokenBlanks = 0;
  let mappedLines = 0;
  for (const id of rowIds) {
    const words = timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text.toLowerCase());
    assert.equal(words.filter((word) => word === "blank").length, 3, `${id} must say blank three times`);
    assert.equal((texts[id].match(/\bblank\b/g) || []).length, 3);
    for (let index = 0; index < 3; index += 1) {
      const marker = `data-answer-for="${id}" data-answer-index="${index}"`;
      assert.ok(page.includes(marker), `${id} answer line ${index + 1} is not mapped`);
      mappedLines += 1;
    }
    spokenBlanks += 3;
  }
  assert.equal(spokenBlanks, 30);
  assert.equal(mappedLines, 30);
  assert.match(bridge, /buildPage27AnswerBlankMap/);
  assert.match(bridge, /word === "blank"/);
});

test("each separately narrated question number highlights its own row", () => {
  assert.match(bridge, /numberRow = source\.closest\("\.place-value-row"\)/);
  assert.match(bridge, /numberRow\.querySelector\("\.visual-question-number"\)/);
  for (const id of questionNumberIds) {
    assert.match(bridge, new RegExp(id.slice(-3)));
    const sourcePosition = page.indexOf(`data-id="${id}"`);
    const rowStart = page.lastIndexOf('<div class="place-value-row">', sourcePosition);
    const rowEnd = page.indexOf("</div>", sourcePosition);
    const row = page.slice(rowStart, rowEnd);
    assert.match(row, /class="visual-question-number"/);
  }
});
