import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const css = fs.readFileSync(new URL("assets/semantic-pages-042-051.css", root), "utf8");
const offlineSource = fs.readFileSync(new URL("assets/offline-data.js", root), "utf8");
const offlinePrefix = "  var INLINE = ";
const offlineStart = offlineSource.indexOf(offlinePrefix) + offlinePrefix.length;
const offlineEnd = offlineSource.indexOf(";\n  var BASE_DIR", offlineStart);
const offline = JSON.parse(offlineSource.slice(offlineStart, offlineEnd));

function page(number) {
  const file = `pg${String(number).padStart(3, "0")}_sec001.html`;
  return { file, html: fs.readFileSync(new URL(file, root), "utf8") };
}

function idsIn(html) {
  return [...html.matchAll(/data-id="([^"]+)"/g)].map((match) => match[1]);
}

test("pages 42 to 51 use the shared responsive Sassoon layout", () => {
  for (let number = 42; number <= 51; number += 1) {
    const { html } = page(number);
    assert.match(html, /width=device-width/);
    assert.match(html, /semantic-pages-042-051\.css/);
    assert.match(html, /class="book-page/);
    assert.doesNotMatch(html, /page_hq_pdf_clean|data-fl-reference-width|auto-fit\.js/);
  }
  assert.match(css, /font-family:"Sassoon Primary Std"/);
  assert.match(css, /\.question-number \{ color:var\(--exercise-blue\)!important/);
});

test("each rebuilt page retains every original ID exactly once", () => {
  for (let number = 42; number <= 51; number += 1) {
    const { file, html } = page(number);
    const ids = idsIn(html);
    const original = execFileSync("git", ["show", `HEAD:${file}`], {
      cwd: new URL(".", root), encoding: "utf8",
    });
    const prefix = `pg${String(number).padStart(3, "0")}_`;
    const originalIds = new Set(idsIn(original).filter((id) => id.startsWith(prefix)));
    assert.ok(ids.length > 0, `${file} has no localization IDs`);
    assert.equal(new Set(ids).size, ids.length, `${file} contains duplicate localization IDs`);
    for (const id of originalIds) assert.ok(ids.includes(id), `${file} lost ${id}`);
    assert.match(html, /base\.bundle\.local\.js/);
    assert.match(html, /offline-preloader\.js/);
  }
});

test("visible read-aloud copies retain highlightable IDs", () => {
  for (const number of [42, 43, 49, 50]) {
    assert.match(page(number).html, /class="highlight-copy" data-id="pg\d{3}_p\d{3}"/);
  }
  assert.match(css, /\.highlight-copy \[data-word-index\]\.bg-yellow-300/);
  assert.match(css, /background:rgba\(253,224,71,\.48\)!important/);
});

test("page-specific corrected structures are present", () => {
  assert.match(page(42).html, /answer-list two-columns column-flow/);
  assert.match(page(43).html, /class="money-scene"/);
  for (const number of [44, 45, 46, 51]) assert.match(page(number).html, /class="place-sum(?:\s|")/);
  for (const number of [46, 47, 48]) assert.match(page(number).html, /class="sum-grid"|class="sum-problem"/);
  assert.match(page(49).html, /class="or-label"/);
  assert.match(page(49).html, /class="bead-frame"/);
  assert.match(page(50).html, /answer-list two-columns column-flow/);
  assert.match(page(51).html, /class="step-grid compact-sums"/);
});

test("offline copies match pages 42 to 51", () => {
  for (let number = 42; number <= 51; number += 1) {
    const { file, html } = page(number);
    assert.equal(offline[`./${file}`], html);
  }
});
