import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ROOT = new URL("../", import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, ROOT), "utf8"));
const texts = readJson("content/i18n/en-GB/texts.json");
const audios = readJson("content/i18n/en-GB/audios.json");
const timecodePath = new URL("content/i18n/en-GB/timecode/timecode_output.json", ROOT);
const timecodes = JSON.parse(readFileSync(timecodePath, "utf8"));
const wordPattern = /[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*|[+\-−–×÷=<>/]/gu;
const pagePattern = /^pg(00[9]|0[1-4][0-9]|050)_p/;
const ASR_DIR = process.env.ADT_ASR_DIR || "/tmp/adt-pages009-050-wav";
const write = process.argv.includes("--write");

const clean = (value) => String(value ?? "")
  .toLocaleLowerCase("en-GB")
  .replace(/[’']/g, "'")
  .replace(/[^\p{L}\p{N}'+\-−–×÷=<>/]+/gu, "")
  .trim();
const displayedTokens = (value) => String(value ?? "").match(wordPattern) ?? [];

const small = new Map(Object.entries({
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90
}));

function numberValue(parts) {
  const words = parts.map((part) => clean(part));
  let total = 0;
  let current = 0;
  let consumed = false;
  for (const word of words) {
    if (!word || word === "and") continue;
    if (/^\d+$/.test(word)) {
      if (words.length === 1) return Number(word);
      return null;
    }
    if (small.has(word)) {
      current += small.get(word);
      consumed = true;
    } else if (word === "hundred" || word === "hundreds") {
      current = (current || 1) * 100;
      consumed = true;
    } else if (word === "thousand" || word === "thousands") {
      total += (current || 1) * 1000;
      current = 0;
      consumed = true;
    } else {
      return null;
    }
  }
  return consumed ? total + current : null;
}

function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 0; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
}

const operatorAliases = {
  "+": ["plus", "add", "+"],
  "-": ["minus", "subtract"],
  "−": ["minus", "subtract"],
  "–": ["minus", "subtract"],
  "×": ["times", "multiply", "multipliedby", "x"],
  "÷": ["divide", "dividedby", "over"],
  "/": ["divide", "dividedby", "over"],
  "=": ["equals", "equal", "equalto", "="],
  "<": ["lessthan"],
  ">": ["greaterthan"]
};

function matchCost(expected, group) {
  const wanted = clean(expected);
  const parts = group.map(({ text }) => clean(text)).filter(Boolean);
  const joined = parts.join("");
  if (!joined) return 9;
  if (parts.length === 1 && joined === wanted) return 0;
  if (joined === wanted) return 0.08 * (parts.length - 1);
  if (/^\d+$/.test(wanted)) {
    if (parts.every((part) => /^\d+$/.test(part)) && parts.join("") === wanted) return 0.12;
    if (numberValue(parts) === Number(wanted)) return 0.04 * (parts.length - 1);
    if (parts.length === 1 && Number(parts[0]) === Number(wanted)) return 0.1;
    const homophones = { "1": ["won"], "2": ["to", "too"], "4": ["for"], "8": ["ate"] };
    if (parts.length === 1 && homophones[wanted]?.includes(parts[0])) return 0.35;
  }
  if (/^\d+s$/.test(wanted)) {
    const value = Number(wanted.slice(0, -1));
    if (numberValue(parts) === value || (value === 100 && parts.join("") === "hundreds")) return 0.2;
  }
  if (operatorAliases[expected]?.includes(joined)) return 0.05 * (parts.length - 1);
  const placeValueAliases = {
    hundreds: ["100", "hundred", "100s", "100's", "hundreds"],
    tens: ["10", "ten", "10s", "10's", "tens"],
    ones: ["1", "one", "1s", "1's", "ones"]
  };
  if (placeValueAliases[wanted]?.includes(joined)) return 0.1;
  if (wanted === "write" && joined === "right") return 0.35;
  if (wanted.length >= 4) {
    const edit = distance(wanted, joined);
    if (edit <= Math.max(1, Math.floor(wanted.length * 0.2))) return 0.55 + edit * 0.12;
  }
  return 5 + Math.min(3, distance(wanted, joined) / Math.max(wanted.length, joined.length));
}

function extractWhisper(id) {
  const path = `${ASR_DIR}/${id}.wav.json`;
  if (!existsSync(path)) return [];
  const json = JSON.parse(readFileSync(path, "utf8"));
  return (json.transcription ?? [])
    .filter(({ text }) => clean(text) && clean(text) !== "-")
    .map(({ text, offsets }) => ({ text: text.trim(), start: offsets.from / 1000, end: offsets.to / 1000 }));
}

function extractCurrent(id) {
  return (timecodes[id]?.timecodes?.[1]?.word_timestamps ?? [])
    .filter(({ text }) => clean(text))
    .map(({ text, start, end }) => ({ text, start: Number(start), end: Number(end) }));
}

function align(expected, source) {
  const n = expected.length;
  const m = source.length;
  const width = m + 1;
  const scores = new Float64Array((n + 1) * width).fill(Number.POSITIVE_INFINITY);
  const back = new Array((n + 1) * width);
  scores[0] = 0;
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      const base = scores[i * width + j];
      if (!Number.isFinite(base)) continue;
      if (j < m) {
        const index = i * width + j + 1;
        const score = base + 1.6;
        if (score < scores[index]) {
          scores[index] = score;
          back[index] = { i, j, skip: true };
        }
      }
      if (i >= n) continue;
      for (let count = 1; count <= Math.min(9, m - j); count += 1) {
        const cost = matchCost(expected[i], source.slice(j, j + count));
        const index = (i + 1) * width + j + count;
        const score = base + cost;
        if (score < scores[index]) {
          scores[index] = score;
          back[index] = { i, j, count };
        }
      }
    }
  }
  let bestJ = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let j = 0; j <= m; j += 1) {
    const score = scores[n * width + j] + (m - j) * 1.6;
    if (score < best) {
      best = score;
      bestJ = j;
    }
  }
  const groups = new Array(n);
  let i = n;
  let j = bestJ;
  while (i || j) {
    const step = back[i * width + j];
    if (!step) break;
    if (!step.skip) groups[i - 1] = source.slice(step.j, step.j + step.count);
    i = step.i;
    j = step.j;
  }
  const bad = Array.from({ length: n }, (_, index) => groups[index])
    .filter((group, index) => !group || matchCost(expected[index], group) >= 5).length;
  return { groups, bad, score: best };
}

function durationOf(id) {
  const filename = audios[id];
  if (!filename) return 0;
  const path = new URL(`content/i18n/en-GB/audio/${filename}`, ROOT).pathname;
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path], { encoding: "utf8" });
  return Number(probe.stdout.trim()) || 0;
}

function makeStamps(expected, groups, duration) {
  const stamps = Array.from({ length: expected.length }, (_, index) => ({
    text: expected[index],
    start: Number(groups[index]?.[0]?.start),
    end: Number(groups[index]?.at(-1)?.end)
  }));
  for (let index = 0; index < stamps.length; index += 1) {
    const stamp = stamps[index];
    const previous = stamps[index - 1];
    if (!Number.isFinite(stamp.start)) stamp.start = previous?.end ?? 0;
    if (previous && stamp.start < previous.end) stamp.start = previous.end;
    if (!Number.isFinite(stamp.end) || stamp.end < stamp.start + 0.1) {
      const nextStart = Number(groups[index + 1]?.[0]?.start);
      stamp.end = Math.min(duration || stamp.start + 0.1, Math.max(stamp.start + 0.1, Number.isFinite(nextStart) ? nextStart : stamp.start + 0.1));
    }
    stamp.start = Number(stamp.start.toFixed(3));
    stamp.end = Number(stamp.end.toFixed(3));
  }
  return stamps;
}

// These clips contain spoken number expansions that Whisper normalises to one
// numeric token. Their boundaries come from the clip's existing speech events
// (or, for the repaired clips, the source events used to assemble the audio).
const manualStamps = {
  pg014_p016: [["16", 0, 0.76]],
  pg014_p036: [["20", 0, 0.64]],
  pg014_p065: [["1", 0.08, 1.05], ["One", 1.24, 1.36], ["hundred", 1.36, 1.55], ["and", 1.55, 1.7], ["two", 1.7, 1.94]],
  pg014_p071: [["7", 0.18, 0.33], ["One", 0.62, 1.04], ["hundred", 1.04, 1.3], ["and", 1.3, 1.74], ["fifteen", 1.74, 2.1]],
  pg015_p009: [["16", 0, 0.98], ["Six", 1.44, 1.64], ["hundred", 1.64, 1.95], ["and", 1.95, 2.2], ["one", 2.2, 2.46]],
  pg015_p007: [["14", 0, 1.1], ["Four", 1.1, 1.33], ["hundred", 1.33, 1.68], ["and", 1.68, 1.9], ["one", 1.9, 2.18]],
  pg015_p002: [["9", 0, 1.08], ["One", 1.9, 2.14], ["hundred", 2.14, 2.42], ["and", 2.42, 2.7], ["nine", 2.7, 2.96]],
  pg015_p003: [["10", 0, 1.14], ["Three", 1.56, 1.8], ["hundred", 1.8, 2.16], ["and", 2.16, 2.58], ["thirty", 2.58, 2.74]],
  pg015_p005: [["12", 0, 0.68], ["One", 1.12, 1.34], ["hundred", 1.34, 1.68], ["and", 1.68, 2.22], ["one", 2.22, 2.44]],
  pg015_p006: [["13", 0, 0.7], ["Three", 1.3, 1.58], ["hundred", 1.58, 1.84], ["and", 1.84, 2.28], ["fifty-five", 2.28, 2.86]],
  pg016_p045: [["4", 0, 0.64]],
  pg026_p011: [["349", 0, 1.94], ["=", 1.94, 2.88], ["3", 2.88, 3.56], ["hundreds", 3.56, 4.04], ["4", 4.04, 4.58], ["tens", 4.58, 4.82]],
  pg033_p009: [["4", 0, 0.64], ["400", 0.98, 1.56], ["+", 1.56, 2.16], ["80", 2.16, 2.56], ["+", 2.56, 3.12], ["6", 3.12, 3.56], ["=", 3.56, 4.24], ["9", 4.3, 4.9]],
  pg041_p001: [["5", 0, 0.78], ["632", 0.78, 2.58], ["+", 2.58, 3.38], ["267", 3.38, 4.78], ["=", 4.78, 5.58]],
  pg050_p014: [["18", 0, 0.88]],
  pg050_p052: [["18", 0, 0.88]]
};
for (const id of [
  "pg014_p004", "pg016_p012", "pg017_p004", "pg018_p067", "pg019_p004", "pg019_p019",
  "pg022_p013", "pg024_p004", "pg025_p004", "pg026_p015", "pg027_p010", "pg028_p004",
  "pg029_p009", "pg030_p012", "pg031_p004", "pg032_p016", "pg046_p033", "pg047_p073",
  "pg049_p009", "pg050_p022"
]) manualStamps[id] = [["1", 0, 0.48]];
for (const id of [
  "pg028_p011", "pg028_p038", "pg028_p053", "pg036_p041", "pg036_p064", "pg036_p070",
  "pg036_p071", "pg036_p072", "pg045_p013", "pg045_p019", "pg045_p024", "pg045_p028",
  "pg045_p033", "pg045_p044", "pg045_p049", "pg046_p007", "pg046_p012", "pg046_p021",
  "pg046_p026", "pg046_p038", "pg046_p055", "pg046_p060", "pg046_p063", "pg046_p064",
  "pg046_p065", "pg046_p067", "pg046_p073", "pg047_p044", "pg047_p054", "pg047_p062",
  "pg047_p068", "pg047_p076", "pg047_p078", "pg047_p087", "pg047_p092", "pg047_p104",
  "pg047_p118", "pg047_p126", "pg047_p128", "pg047_p131", "pg047_p140", "pg047_p144",
  "pg047_p152", "pg048_p004", "pg048_p006", "pg048_p007", "pg048_p014", "pg048_p015"
]) manualStamps[id] = [["3", 0, 0.62]];
for (const id of ["pg010_p166", "pg013_p040"]) manualStamps[id] = [["360", 0.166, 1.798]];

const ids = Object.keys(audios).filter((id) => pagePattern.test(id));
const failures = [];
let rebuilt = 0;
for (const id of ids) {
  const expected = displayedTokens(texts[id]);
  if (!expected.length) continue;
  if (manualStamps[id]) {
    const stamps = manualStamps[id].map(([text, start, end]) => ({ text, start, end }));
    if (stamps.map(({ text }) => text).join("\0") !== expected.join("\0")) {
      failures.push(`${id}: manual timing text no longer matches displayed text`);
      continue;
    }
    timecodes[id] = { timecodes: [null, { word_timestamps: stamps }] };
    rebuilt += 1;
    continue;
  }
  const rawCurrent = timecodes[id]?.timecodes?.[1]?.word_timestamps ?? [];
  const current = extractCurrent(id);
  const currentTimingIsValid = rawCurrent.length === expected.length && current.length === expected.length && current.every(({ start, end }, index) =>
    Number.isFinite(start) && Number.isFinite(end) && end - start >= 0.099 && (!index || start >= current[index - 1].end - 1e-6)
  );
  if (currentTimingIsValid) {
    const normalized = rawCurrent.map((stamp, index) => ({ ...stamp, text: expected[index] }));
    if (rawCurrent.some((stamp, index) => stamp.text !== expected[index])) rebuilt += 1;
    timecodes[id] = { timecodes: [null, { word_timestamps: normalized }] };
    continue;
  }
  const candidates = [current, extractWhisper(id)].filter((candidate) => candidate.length);
  const aligned = candidates.map((candidate) => align(expected, candidate)).sort((a, b) => a.bad - b.bad || a.score - b.score)[0];
  if (!aligned || aligned.bad) {
    failures.push(`${id}: ${expected.join(" ")} (unmatched ${aligned?.bad ?? "no timing source"})`);
    continue;
  }
  const duration = durationOf(id);
  const stamps = makeStamps(expected, aligned.groups, duration);
  if (stamps.some((stamp, index) => stamp.end - stamp.start < 0.099 || stamp.end > duration + 0.05 || (index && stamp.start < stamps[index - 1].end))) {
    failures.push(`${id}: generated timing validation failed`);
    continue;
  }
  timecodes[id] = { timecodes: [null, { word_timestamps: stamps }] };
  rebuilt += 1;
}

if (failures.length) {
  console.error(failures.join("\n"));
  console.error(`${failures.length} passages still need review; ${rebuilt} were aligned.`);
  process.exitCode = 1;
} else {
  console.log(`${rebuilt} passages aligned to their displayed words and symbols.`);
}
if (write) {
  writeFileSync(timecodePath, `${JSON.stringify(timecodes, null, 2)}\n`);
  const offlinePath = new URL("assets/offline-data.js", ROOT);
  const offlineSource = readFileSync(offlinePath, "utf8");
  const prefix = "  var INLINE = ";
  const suffix = ";\n  var BASE_DIR";
  const start = offlineSource.indexOf(prefix) + prefix.length;
  const end = offlineSource.indexOf(suffix, start);
  if (start < prefix.length || end < 0) throw new Error("Could not locate the offline data payload");
  const inline = JSON.parse(offlineSource.slice(start, end));
  inline["./content/i18n/en-GB/timecode/timecode_output.json"] = timecodes;
  inline["./content/i18n/en-GB/texts.json"] = texts;
  inline["./content/i18n/en-GB/audios.json"] = audios;
  writeFileSync(offlinePath, `${offlineSource.slice(0, start)}${JSON.stringify(inline)}${offlineSource.slice(end)}`);
}
