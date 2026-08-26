import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const ids = [
  "pg019_p020", "pg019_p024", "pg019_p028", "pg019_p032", "pg019_p036",
  "pg019_p022", "pg019_p026", "pg019_p030", "pg019_p034", "pg019_p037",
];

test("page 19 Exercise 8 uses complete male comma-and-blank narration", () => {
  assert.equal(texts.pg019_p037, "10. _____, 220, 219");
  for (const id of ids) {
    assert.match(audios[id], /_male_commas_free_tts\.mp3$/);
    const audio = path.join(root, "content/i18n/en-GB/audio", audios[id]);
    assert.ok(fs.statSync(audio).size > 30_000, `${id} audio appears incomplete`);
    const displayed = texts[id].match(/\d+|_{3,}/g);
    const timed = timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text);
    assert.deepEqual(timed, displayed, `${id} must include every printed number and blank in order`);
  }
});

