import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const ids = ["pg017_p019", "pg017_p020", "pg017_p021", "pg017_p022", "pg017_p023"];

test("page 17 Exercise 3 uses complete male comma-and-blank narration", () => {
  for (const id of ids) {
    assert.match(audios[id], /_male_commas_free_tts\.mp3$/);
    const audio = path.join(root, "content/i18n/en-GB/audio", audios[id]);
    assert.ok(fs.statSync(audio).size > 50_000, `${id} audio appears incomplete`);
    const displayed = texts[id].match(/\d+|_{3,}/g);
    const timed = timecodes[id].timecodes[1].word_timestamps.map(({ text }) => text);
    assert.deepEqual(timed, displayed, `${id} must include every printed number and blank in order`);
  }
});

