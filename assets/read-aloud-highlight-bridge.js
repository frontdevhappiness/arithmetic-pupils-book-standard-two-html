(function () {
  "use strict";

  var CONTENT_ID = "content";
  var MARKER_ID = "adt-visible-narration-highlight";
  var STYLE_ID = "adt-visible-narration-highlight-style";
  var CUSTOM_HIGHLIGHT_NAME = "adt-narration-word";
  var WORD_SELECTOR = "[data-word-index].bg-yellow-300";
  var WORD_PATTERN = /[\p{L}\p{N}\p{M}]+(?:[’'-][\p{L}\p{N}\p{M}]+)*|[+\-−–×÷=<>/]/gu;
  var currentSource = null;
  var currentMode = "";
  var currentMap = null;
  var scheduled = 0;

  var ORDERED_TEXT_ROOTS = {
    pg142_sec001: [
      ".pg142-banner",
      ".pg142-intro",
      ".pg142-item-one .pg142-number",
      ".pg142-item-one .pg142-caption",
      ".pg142-item-two .pg142-number",
      ".pg142-item-two .pg142-caption",
      ".pg142-item-three .pg142-number",
      ".pg142-item-three .pg142-caption",
      ".pg142-item-four .pg142-number",
      ".pg142-item-four .pg142-caption",
      ".pg142-item-five .pg142-number",
      ".pg142-item-five .pg142-caption",
      ".pg142-item-six .pg142-number",
      ".pg142-item-six .pg142-caption",
      ".pg142-prompts .pg142-prompt:nth-child(1)",
      ".pg142-prompts .pg142-prompt:nth-child(2)"
    ]
  };

  function normalizeWord(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" + MARKER_ID + "{position:fixed;inset:0;pointer-events:none;z-index:45}" +
      "#" + MARKER_ID + ">span{position:absolute;box-sizing:border-box;border-radius:3px;background:rgba(253,224,71,.58);mix-blend-mode:multiply}" +
      "::highlight(" + CUSTOM_HIGHLIGHT_NAME + "){background:#fde047;color:inherit}" +
      "#" + MARKER_ID + ".adt-block-highlight>span{background:rgba(37,99,235,.10);box-shadow:inset 0 0 0 2px rgba(37,99,235,.85);mix-blend-mode:normal}";
    document.head.appendChild(style);
  }

  function getMarker() {
    ensureStyles();
    var marker = document.getElementById(MARKER_ID);
    if (!marker) {
      marker = document.createElement("div");
      marker.id = MARKER_ID;
      marker.setAttribute("aria-hidden", "true");
      document.body.appendChild(marker);
    }
    return marker;
  }

  function clearMarker() {
    if (window.CSS && CSS.highlights) CSS.highlights.delete(CUSTOM_HIGHLIGHT_NAME);
    var marker = document.getElementById(MARKER_ID);
    if (!marker) return;
    marker.replaceChildren();
    marker.removeAttribute("data-source-id");
    marker.removeAttribute("data-word-index");
    marker.removeAttribute("data-custom-highlight");
    marker.classList.remove("adt-block-highlight");
  }

  function isHiddenNarrationElement(element) {
    if (!element) return false;
    if (element.matches(".sr-only,.narration-only,[hidden]")) return true;
    if (element.closest(".sr-only,.narration-only,[hidden]")) return true;
    var style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return true;
    var rect = element.getBoundingClientRect();
    return rect.width <= 2 && rect.height <= 2 && (style.position === "absolute" || style.position === "fixed");
  }

  function findActiveNarration(content) {
    var highlightedWords = content.querySelectorAll(WORD_SELECTOR);
    for (var i = 0; i < highlightedWords.length; i += 1) {
      var source = highlightedWords[i].closest("[data-id]");
      if (source && isHiddenNarrationElement(source)) {
        return { mode: "word", source: source, word: highlightedWords[i] };
      }
    }

    var highlightedBlocks = content.querySelectorAll("[data-id].tts-active-block");
    for (var j = 0; j < highlightedBlocks.length; j += 1) {
      if (isHiddenNarrationElement(highlightedBlocks[j])) {
        return { mode: "block", source: highlightedBlocks[j], word: null };
      }
    }
    return null;
  }

  function excludedTextNode(node, content) {
    var parent = node.parentElement;
    if (!parent || !node.nodeValue || !node.nodeValue.trim()) return true;
    for (var element = parent; element && element !== content; element = element.parentElement) {
      if (element.matches("script,style,noscript,.sr-only,.narration-only,[hidden]")) return true;
      var style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return true;
    }
    return false;
  }

  function textRoots(content) {
    var section = content.querySelector("[data-section-id]");
    var selectors = section && ORDERED_TEXT_ROOTS[section.getAttribute("data-section-id")];
    if (!selectors) return [content];
    var roots = selectors.map(function (selector) {
      return section.querySelector(selector);
    }).filter(Boolean);
    return roots.length ? roots : [content];
  }

  function collectRootTokens(root, content) {
    var tokens = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (excludedTextNode(node, content)) continue;
      WORD_PATTERN.lastIndex = 0;
      var match;
      while ((match = WORD_PATTERN.exec(node.nodeValue))) {
        var normalized = normalizeWord(match[0]);
        if (!normalized) continue;
        var range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        tokens.push({ normalized: normalized, range: range });
      }
    }
    return tokens;
  }

  function collectVisibleTokens(content) {
    var tokens = [];
    textRoots(content).forEach(function (root) {
      tokens.push.apply(tokens, collectRootTokens(root, content));
    });
    return tokens;
  }

  function collectNarrationTokens(source) {
    var wrapped = source.querySelectorAll("[data-word-index]");
    if (wrapped.length) {
      return Array.from(wrapped, function (element) {
        return normalizeWord(element.textContent);
      });
    }
    var tokens = [];
    WORD_PATTERN.lastIndex = 0;
    var match;
    while ((match = WORD_PATTERN.exec(source.textContent || ""))) {
      tokens.push(normalizeWord(match[0]));
    }
    return tokens;
  }

  function alignTokens(narration, visible) {
    var rows = narration.length + 1;
    var cols = visible.length + 1;
    var table = new Uint16Array(rows * cols);
    var i;
    var j;
    for (i = narration.length - 1; i >= 0; i -= 1) {
      for (j = visible.length - 1; j >= 0; j -= 1) {
        var at = i * cols + j;
        table[at] = narration[i] === visible[j].normalized
          ? 1 + table[(i + 1) * cols + j + 1]
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
      }
    }

    var mapping = new Array(narration.length).fill(null);
    i = 0;
    j = 0;
    while (i < narration.length && j < visible.length) {
      if (narration[i] === visible[j].normalized && table[i * cols + j] === 1 + table[(i + 1) * cols + j + 1]) {
        mapping[i] = visible[j].range;
        i += 1;
        j += 1;
      } else if (table[(i + 1) * cols + j] > table[i * cols + j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    return mapping;
  }

  function buildPage94ShareMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg094_p001") return null;
    var section = content.querySelector('[data-section-id="pg094_sec001"]');
    if (!section) return null;

    var mapping = new Array(narration.length).fill(null);
    var cursor = 0;
    section.querySelectorAll(".share").forEach(function (share) {
      var roots = [share.querySelector(".share-title")].concat(Array.from(share.querySelectorAll(".group-heading")));
      roots.filter(Boolean).forEach(function (root) {
        collectRootTokens(root, content).forEach(function (token) {
          while (cursor < narration.length && narration[cursor] !== token.normalized) cursor += 1;
          if (cursor < narration.length) {
            mapping[cursor] = token.range;
            cursor += 1;
          }
        });
      });
    });
    return mapping;
  }

  function buildPage23TableMap(content, source, narration) {
    var targets = {
      pg023_p019: "all",
      pg023_im002: 0,
      pg023_im003: 1,
      pg023_im001: 2
    };
    var id = source.getAttribute("data-id");
    if (!Object.prototype.hasOwnProperty.call(targets, id)) return null;
    var section = content.querySelector('[data-section-id="pg023_sec001"]');
    if (!section) return null;
    var headings = Array.from(section.querySelectorAll(".question:first-child .column-heading")).map(function (heading) {
      var token = collectRootTokens(heading, content)[0];
      return token && token.range;
    }).filter(Boolean);
    if (headings.length !== 3) return null;

    if (targets[id] !== "all") return new Array(narration.length).fill(headings[targets[id]]);
    return narration.map(function (word) {
      if (word === "hundreds") return headings[0];
      if (word === "tens") return headings[1];
      if (word === "ones") return headings[2];
      return headings;
    });
  }

  function buildMap(content, source) {
    var narration = collectNarrationTokens(source);
    return buildPage23TableMap(content, source, narration) || buildPage94ShareMap(content, source, narration) || alignTokens(narration, collectVisibleTokens(content));
  }

  function usableRect(range) {
    if (!range) return null;
    var rects = Array.from(range.getClientRects()).filter(function (rect) {
      return rect.width > 0 && rect.height > 0;
    });
    return rects[0] || null;
  }

  function mergeLineRects(rects) {
    var sorted = rects.slice().sort(function (a, b) {
      return Math.abs(a.top - b.top) < 3 ? a.left - b.left : a.top - b.top;
    });
    var merged = [];
    sorted.forEach(function (rect) {
      var previous = merged[merged.length - 1];
      if (previous && Math.abs(previous.top - rect.top) < 3 && rect.left - previous.right < 8) {
        previous.right = Math.max(previous.right, rect.right);
        previous.bottom = Math.max(previous.bottom, rect.bottom);
        previous.width = previous.right - previous.left;
        previous.height = previous.bottom - previous.top;
      } else {
        merged.push({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        });
      }
    });
    return merged;
  }

  function drawRects(rects, source, wordIndex, blockMode) {
    if (window.CSS && CSS.highlights) CSS.highlights.delete(CUSTOM_HIGHLIGHT_NAME);
    var marker = getMarker();
    marker.replaceChildren();
    marker.classList.toggle("adt-block-highlight", blockMode);
    marker.removeAttribute("data-custom-highlight");
    marker.setAttribute("data-source-id", source.getAttribute("data-id") || "");
    if (wordIndex === null) marker.removeAttribute("data-word-index");
    else marker.setAttribute("data-word-index", String(wordIndex));

    rects.forEach(function (rect) {
      var span = document.createElement("span");
      span.style.left = rect.left - 1 + "px";
      span.style.top = rect.top - 1 + "px";
      span.style.width = rect.width + 2 + "px";
      span.style.height = rect.height + 2 + "px";
      marker.appendChild(span);
    });
  }

  function drawWord(target, source, wordIndex) {
    var ranges = Array.isArray(target) ? target : [target];
    if (window.CSS && CSS.highlights && typeof window.Highlight === "function") {
      var marker = getMarker();
      marker.replaceChildren();
      marker.classList.remove("adt-block-highlight");
      marker.setAttribute("data-source-id", source.getAttribute("data-id") || "");
      marker.setAttribute("data-word-index", String(wordIndex));
      marker.setAttribute("data-custom-highlight", "true");
      CSS.highlights.set(CUSTOM_HIGHLIGHT_NAME, new Highlight(...ranges));
      return;
    }
    var rects = ranges.map(usableRect).filter(Boolean);
    if (rects.length) drawRects(rects, source, wordIndex, false);
  }

  function render() {
    scheduled = 0;
    var content = document.getElementById(CONTENT_ID);
    if (!content) {
      clearMarker();
      return;
    }
    var active = findActiveNarration(content);
    if (!active) {
      currentSource = null;
      currentMode = "";
      currentMap = null;
      clearMarker();
      return;
    }

    var sourceChanged = active.source !== currentSource || active.mode !== currentMode || !currentMap;
    if (sourceChanged) {
      clearMarker();
      currentSource = active.source;
      currentMode = active.mode;
      currentMap = buildMap(content, active.source);
    }

    if (active.mode === "word") {
      var index = Number(active.word.getAttribute("data-word-index"));
      var target = currentMap[index];
      var usable = (Array.isArray(target) ? target : [target]).some(function (item) { return usableRect(item); });
      if (usable) drawWord(target, active.source, index);
      else {
        var marker = document.getElementById(MARKER_ID);
        var samePassage = marker && marker.getAttribute("data-source-id") === (active.source.getAttribute("data-id") || "");
        var hasHighlight = marker && (marker.children.length || marker.getAttribute("data-custom-highlight") === "true");
        if (!samePassage || !hasHighlight) clearMarker();
      }
      return;
    }

    var rects = currentMap.flatMap(function (target) {
      return (Array.isArray(target) ? target : [target]).map(usableRect).filter(Boolean);
    });
    if (rects.length) drawRects(mergeLineRects(rects), active.source, null, true);
    else clearMarker();
  }

  function schedule() {
    if (!scheduled) scheduled = window.setTimeout(render, 0);
  }

  function start() {
    var content = document.getElementById(CONTENT_ID);
    if (!content) {
      requestAnimationFrame(start);
      return;
    }
    new MutationObserver(schedule).observe(content, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("adt:dock-resize", schedule);
    schedule();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
