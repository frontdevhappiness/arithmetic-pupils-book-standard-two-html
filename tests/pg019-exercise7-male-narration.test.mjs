import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const ids = ["pg019_p005", "pg019_p009", "pg019_p013", "pg019_p007", "pg019_p011", "pg019_p015"];

test("page 19 Exercise 7 uses complete male comma-and-blank narration", () => {
  assert.equal(texts.pg019_p015, "315, _____, 113", "question 6 must match the original page");
  for (const id of ids) {
    assert.match(audios[id], /_male_commas_free_tts\.mp3$/);
    const audio = path.join(root, "content/i18n/en-GB/audio", audios[id]);
    assert.ok(fs.statSync(audio).size > 30_000, `${id} audio appears incomplete`);
    const displayed = texts[id].match(/\d+|_{3,}/g);
    const timed = timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text);
    assert.deepEqual(timed, displayed, `${id} must include every printed number and blank in order`);
  }
});
