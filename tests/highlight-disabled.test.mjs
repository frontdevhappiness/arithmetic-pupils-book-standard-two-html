import assert from "node:assert/strict";
import fs from "node:fs";

const config = JSON.parse(fs.readFileSync("assets/config.json", "utf8"));
const css = fs.readFileSync("assets/fonts.css", "utf8");
const pages = [
  "index.html",
  ...Array.from({ length: 143 }, (_, index) => `pg${String(index + 2).padStart(3, "0")}_sec001.html`),
];

assert.equal(config.features.highlight, false, "word highlighting must remain disabled in the book configuration");
assert.match(css, /html body \[id\^='adt-pg'\]\[id\$='-word-highlight'\]/, "legacy page-specific markers must be hidden");
assert.match(css, /html body #content \.adt-page-overlay-text span\[data-word-index\]\.bg-yellow-300::before/, "page-level before markers must be overridden with higher specificity");
assert.match(css, /background-color: transparent !important/, "runtime word backgrounds must be transparent");
assert.match(css, /content: none !important/, "generated yellow markers must not render");

for (const page of pages) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /assets\/fonts\.css/, `${page} must load the shared highlight suppression`);
  for (const marker of html.match(/adt-pg\d+-word-highlight/g) ?? []) {
    assert.match(css, new RegExp(`html body #${marker}`), `${page} custom marker must be overridden with ID-level specificity`);
  }
}

console.log(`Highlight suppression verified across ${pages.length} pages.`);
