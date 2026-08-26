import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const json = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const texts = json("content/i18n/en-GB/texts.json");
const audios = json("content/i18n/en-GB/audios.json");
const timecodes = json("content/i18n/en-GB/timecode/timecode_output.json");
const page = fs.readFileSync(path.join(root, "pg022_sec001.html"), "utf8");
const ids = ["pg022_p017", "pg022_p018", "pg022_p019", "pg022_p020"];
const expectedAudio = {
  pg022_p017: "pg022_hundreds_blank_male_free_tts.mp3",
  pg022_p018: "pg022_tens_blank_male_free_tts.mp3",
  pg022_p019: "pg022_ones_blank_male_free_tts.mp3",
  pg022_p020: "pg022_total_words_blank_male_free_tts.mp3",
};

test("page 22 Exercise 1 narrates every printed answer line as blank", () => {
  for (const id of ids) {
    assert.match(texts[id], /^_+$/, `${id} must remain a printed answer line`);
    assert.equal(audios[id], expectedAudio[id]);
    const audio = path.join(root, "content/i18n/en-GB/audio", audios[id]);
    assert.ok(fs.statSync(audio).size > 15_000, `${id} male blank-line description appears incomplete`);
    assert.equal(timecodes[id].timecodes[1].word_timestamps[0].text, texts[id]);
  }
});

test("page 22 answer lines are included in Exercise 1 reading order", () => {
  const expectedOrder = [
    "pg022_p014", "pg022_im003", "pg022_p017",
    "pg022_p015", "pg022_im004", "pg022_p018",
    "pg022_p016", "pg022_im005", "pg022_p019", "pg022_p020",
  ];
  const positions = expectedOrder.map((id) => page.lastIndexOf(`"${id}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
