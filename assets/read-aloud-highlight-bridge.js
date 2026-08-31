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
      "#" + MARKER_ID + "[data-source-id^='pg036_']>span{background:#fde047}" +
      "#" + MARKER_ID + "[data-source-id='pg046_p079']>span{background:#fde047}" +
      "#" + MARKER_ID + "[data-source-id^='pg047_p17']>span{background:#fde047}" +
      "#" + MARKER_ID + "[data-source-id^='pg048_p05']>span{background:#fde047}" +
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

  function wrapPage36VisualWords(copy) {
    if (!copy || copy.getAttribute("data-visual-words-ready") === "true") return;
    var walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    var wordIndex = 0;
    nodes.forEach(function (textNode) {
      var value = textNode.nodeValue || "";
      var pattern = new RegExp(WORD_PATTERN.source, "gu");
      var fragment = document.createDocumentFragment();
      var cursor = 0;
      var match;
      while ((match = pattern.exec(value))) {
        if (match.index > cursor) fragment.appendChild(document.createTextNode(value.slice(cursor, match.index)));
        var span = document.createElement("span");
        span.className = "visual-word";
        span.setAttribute("data-visual-word-index", String(wordIndex));
        span.textContent = match[0];
        fragment.appendChild(span);
        wordIndex += 1;
        cursor = match.index + match[0].length;
      }
      if (cursor < value.length) fragment.appendChild(document.createTextNode(value.slice(cursor)));
      textNode.replaceWith(fragment);
    });
    copy.setAttribute("data-visual-words-ready", "true");
  }

  function syncPage36InstructionHighlight(content) {
    content.querySelectorAll('.exercise-nine .live-copy').forEach(function (liveCopy) {
      var visualCopy = liveCopy.querySelector('.visual-copy');
      var highlightCopy = liveCopy.querySelector('.highlight-copy');
      if (!visualCopy || !highlightCopy) return;
      wrapPage36VisualWords(visualCopy);
      var active = highlightCopy.querySelector('[data-word-index].bg-yellow-300');
      var activeIndex = active ? active.getAttribute('data-word-index') : null;
      visualCopy.querySelectorAll('[data-visual-word-index]').forEach(function (word) {
        word.classList.toggle('visual-word-active', activeIndex !== null && word.getAttribute('data-visual-word-index') === activeIndex);
      });
    });
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

  function buildPage24AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg024_p(?:008|009|010|015|016|017|022|023|024)$/.test(id || "")) return null;
    var section = content.querySelector('[data-section-id="pg024_sec001"]');
    if (!section) return null;
    var line = section.querySelector('[data-answer-for="' + id + '"]');
    var target = line && line.closest(".answer-cell");
    return target ? new Array(narration.length).fill(target) : null;
  }

  function buildPage25AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg025_p(?:005|007|009|011|013|015)$/.test(id || "")) return null;
    var section = content.querySelector('[data-section-id="pg025_sec001"]');
    if (!section) return null;
    var target = section.querySelector('[data-answer-for="' + id + '"]');
    return target ? new Array(narration.length).fill(target) : null;
  }

  function buildPage27AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (/^pg027_p(?:010|012|014|016|018|020|022|024|026)$/.test(id || "")) {
      var numberRow = source.closest(".place-value-row");
      var numberTarget = numberRow && numberRow.querySelector(".visual-question-number");
      return numberTarget ? new Array(narration.length).fill(numberTarget) : null;
    }
    if (!/^pg027_p(?:011|013|015|017|019|021|023|025|027|028)$/.test(id || "")) return null;
    var row = source.closest(".place-value-row");
    if (!row) return null;
    var mapping = alignTokens(narration, collectRootTokens(row, content));
    var lines = Array.from(row.querySelectorAll('[data-answer-for="' + id + '"]'));
    var blankIndex = 0;
    narration.forEach(function (word, index) {
      if (word === "blank" && lines[blankIndex]) {
        mapping[index] = lines[blankIndex];
        blankIndex += 1;
      }
    });
    return blankIndex === 3 ? mapping : null;
  }

  function buildPage28ExerciseRowMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg028_p(?:004|010|016|022|028|034|040|046|052|058)$/.test(id || "")) return null;
    var row = source.closest(".exercise3-row");
    return row ? alignTokens(narration, collectRootTokens(row, content)) : null;
  }

  function buildPage29ExerciseDiagramMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg029_p(?:009|010|011|012|013|014)$/.test(id || "")) return null;
    var question = source.closest(".diagram-question");
    if (!question) return null;
    var targets = [];
    var questionNumber = question.querySelector(".question-number");
    if (questionNumber) targets.push(collectRootTokens(questionNumber, content)[0]);
    ["hundreds", "tens", "ones"].forEach(function (place) {
      var digit = question.querySelector('[data-place-digit="' + place + '"]');
      var label = question.querySelector(".place-line." + place + " span");
      if (digit) targets.push(collectRootTokens(digit, content)[0]);
      if (digit && label) targets.push(collectRootTokens(label, content)[0]);
    });
    if (targets.length !== narration.length || targets.some(function (target) { return !target; })) return null;
    return narration.map(function (word, index) {
      return targets[index].normalized === word ? targets[index].range : null;
    });
  }

  function buildPage30ExerciseMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (/^pg030_p00[1-8]$/.test(id || "")) {
      var question = source.closest(".diagram-question");
      if (!question) return null;
      var targets = [];
      var questionNumber = question.querySelector(".question-number");
      if (questionNumber) targets.push(collectRootTokens(questionNumber, content)[0]);
      ["hundreds", "tens", "ones"].forEach(function (place) {
        var digit = question.querySelector('[data-place-digit="' + place + '"]');
        var label = question.querySelector(".place-line." + place + " span");
        if (digit) targets.push(collectRootTokens(digit, content)[0]);
        if (digit && label) targets.push(collectRootTokens(label, content)[0]);
      });
      if (targets.length !== narration.length || targets.some(function (target) { return !target; })) return null;
      return narration.map(function (word, index) {
        return targets[index].normalized === word ? targets[index].range : null;
      });
    }
    if (!/^pg030_p(?:012|014|016|018|020|022|024|026|028|030)$/.test(id || "")) return null;
    var row = source.closest(".number-list p");
    return row ? alignTokens(narration, collectRootTokens(row, content)) : null;
  }

  function buildPage31AnswerBlankMap(content, source, narration) {
    var id = source.getAttribute("data-id");
    if (!/^pg031_p(?:007|009|011|013|015)$/.test(id || "")) return null;
    var section = content.querySelector('[data-section-id="pg031_sec001"]');
    if (!section) return null;
    var target = section.querySelector('[data-answer-for="' + id + '"]');
    return target ? new Array(narration.length).fill(target) : null;
  }

  function buildPage36TableMap(content, source, narration) {
    var id = source.getAttribute("data-id") || "";
    if (/^pg036_p(?:086|087|088|089|090|091|092|093)$/.test(id)) {
      var blankCell = source.closest("td");
      return blankCell ? new Array(narration.length).fill(blankCell) : null;
    }
    var question3 = /^pg036_p07[6-9]$|^pg036_p080$/.test(id);
    var question4 = /^pg036_p08[1-5]$/.test(id);
    if (!question3 && !question4) return null;

    var section = source.closest("section");
    var table = section && section.querySelector("table");
    if (!table) return null;
    var rowIndex = Number(id.slice(-3)) - (question3 ? 76 : 81);
    var row = table.tBodies[0] && table.tBodies[0].rows[rowIndex];
    if (!row) return null;

    var headers = Array.from(table.querySelectorAll("thead th")).map(function (header) {
      var token = collectRootTokens(header, content)[0];
      return token && token.range;
    });
    var cells = Array.from(row.cells).map(function (cell) {
      var token = collectRootTokens(cell, content)[0];
      return token && token.range;
    });

    if (question3) {
      var printedNumber = collectRootTokens(row.cells[0], content)[0];
      var digitNames = { "2": "two", "3": "three", "6": "six", "9": "nine" };
      var cellCursor = 1;
      var blankTarget = null;
      var lastPlaceHeader = null;
      return narration.map(function (word, index) {
        if (printedNumber && index < 4) return printedNumber.range;
        if (printedNumber && word === printedNumber.normalized) return printedNumber.range;
        if (word === "blank" && cellCursor < cells.length) {
          blankTarget = row.cells[cellCursor];
          var target = blankTarget;
          blankTarget = null;
          cellCursor += 1;
          return target;
        }
        if (cellCursor < cells.length && cells[cellCursor]) {
          var printedDigit = collectRootTokens(row.cells[cellCursor], content)[0];
          if (printedDigit && word === digitNames[printedDigit.normalized]) {
            cellCursor += 1;
            return printedDigit.range;
          }
        }
        if (word === "hundreds") lastPlaceHeader = headers[1];
        else if (word === "tens") lastPlaceHeader = headers[2];
        else if (word === "ones") lastPlaceHeader = headers[3];
        else if (word !== "column") return null;
        return lastPlaceHeader;
      });
    }

    var placeCursor = 0;
    var lastHeader = null;
    var numberNames = /^(?:zero|one|two|three|four|five|six|seven|eight|nine)$/;
    return narration.map(function (word) {
      if (numberNames.test(word) && placeCursor < 3) {
        var target = cells[placeCursor];
        placeCursor += 1;
        return target;
      }
      if (word === "blank") return row.cells[3];
      if (word === "hundreds") lastHeader = headers[0];
      else if (word === "tens") lastHeader = headers[1];
      else if (word === "ones") lastHeader = headers[2];
      else if (word === "number") lastHeader = headers[3];
      else if (word !== "column") return null;
      return lastHeader;
    });
  }

  function buildPage37ChapterBannerMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg037_im007") return null;
    var ids = ["pg037_p023", "pg037_p024", "pg037_p022"];
    var targets = ids.map(function (id) {
      var element = content.querySelector('[data-id="' + id + '"]');
      var token = element && collectRootTokens(element, content)[0];
      return token ? token.range : null;
    });
    if (targets.some(function (target) { return !target; })) return null;
    return narration.map(function (_word, index) {
      return targets[index] || null;
    });
  }

  function buildPage37ExampleMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg037_im008") return null;

    function tokens(id) {
      var element = content.querySelector('[data-id="' + id + '"]');
      return element ? collectRootTokens(element, content) : [];
    }

    function textRange(id, start, end) {
      var element = content.querySelector('[data-id="' + id + '"]');
      var node = element && element.firstChild;
      if (!node || node.nodeType !== Node.TEXT_NODE || end > node.nodeValue.length) return null;
      var range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      return range;
    }

    var label = tokens("pg037_p007");
    var expression = tokens("pg037_p008");
    var finalLine = tokens("pg037_p021");
    var hundreds = tokens("pg037_p009")[0];
    var tens = tokens("pg037_p010")[0];
    var ones = tokens("pg037_p011")[0];
    var addHundreds = tokens("pg037_p012")[0];
    var addTens = tokens("pg037_p013")[0];
    var addOnes = tokens("pg037_p014")[0];
    var equalsHundreds = tokens("pg037_p015")[0];
    var equalsTens = tokens("pg037_p016")[0];
    var equalsOnes = tokens("pg037_p017")[0];
    var fiveHundreds = tokens("pg037_p018")[0];
    var sixTens = tokens("pg037_p019")[0];
    var eightOnes = tokens("pg037_p020")[0];
    if (label.length < 2 || expression.length < 2 || finalLine.length < 4 || !hundreds || !tens || !ones) return null;

    var mapping = new Array(narration.length).fill(null);
    mapping[0] = label[0].range;
    mapping[1] = label[1].range;
    mapping[3] = textRange("pg037_p008", 0, 3);
    mapping[4] = textRange("pg037_p008", 4, 5);
    mapping[5] = textRange("pg037_p008", 6, 9);
    mapping[7] = [hundreds.range, tens.range, ones.range];
    mapping[8] = mapping[7];
    mapping[9] = textRange("pg037_p008", 0, 1);
    mapping[10] = hundreds.range;
    mapping[11] = addHundreds && addHundreds.range;
    mapping[12] = mapping[11];
    mapping[13] = textRange("pg037_p008", 6, 7);
    mapping[14] = hundreds.range;
    mapping[15] = equalsHundreds && equalsHundreds.range;
    mapping[16] = fiveHundreds && fiveHundreds.range;
    mapping[17] = hundreds.range;
    mapping[18] = textRange("pg037_p008", 1, 2);
    mapping[19] = tens.range;
    mapping[20] = addTens && addTens.range;
    mapping[21] = mapping[20];
    mapping[22] = textRange("pg037_p008", 7, 8);
    mapping[23] = tens.range;
    mapping[24] = equalsTens && equalsTens.range;
    mapping[25] = sixTens && sixTens.range;
    mapping[26] = tens.range;
    mapping[28] = textRange("pg037_p008", 2, 3);
    mapping[29] = ones.range;
    mapping[30] = addOnes && addOnes.range;
    mapping[31] = mapping[30];
    mapping[32] = textRange("pg037_p008", 8, 9);
    mapping[33] = ones.range;
    mapping[34] = equalsOnes && equalsOnes.range;
    mapping[35] = eightOnes && eightOnes.range;
    mapping[36] = ones.range;
    mapping[37] = finalLine[0].range;
    mapping[38] = finalLine[1].range;
    mapping[39] = textRange("pg037_p021", 15, 16);
    mapping[40] = finalLine[2].range;
    mapping[41] = textRange("pg037_p021", 21, 22);
    mapping[42] = finalLine[3].range;
    return mapping;
  }

  function buildPage39ModelMap(_content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg039_p039" && sourceId !== "pg039_p040") return null;
    var model = source.closest(".place-model");
    var columns = model ? Array.from(model.querySelectorAll(".place-model-grid > div")) : [];
    if (columns.length !== 3) return null;

    var headers = columns.map(function (column) { return column.querySelector("h3"); });
    var firstCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[0]; });
    var secondCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[1]; });
    var adds = columns.map(function (column) { return column.querySelectorAll(".model-word")[0]; });
    var equals = columns.map(function (column) { return column.querySelectorAll(".model-word")[1]; });
    var answers = columns.map(function (column) { return column.querySelector(".model-answer"); });
    var finalLine = model.querySelector(".model-final");
    if ([headers, firstCounters, secondCounters, adds, equals, answers].some(function (items) { return items.some(function (item) { return !item; }); }) || !finalLine) return null;

    var mapping = new Array(narration.length).fill(null);
    function assign(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }

    assign(3, 6, headers[0]);
    assign(7, 9, firstCounters[0]);
    assign(10, 12, adds[0]);
    assign(13, 15, secondCounters[0]);
    mapping[16] = equals[0];
    assign(17, 20, headers[1]);
    assign(21, 23, firstCounters[1]);
    assign(24, 26, adds[1]);
    assign(27, 29, secondCounters[1]);
    mapping[30] = equals[1];
    assign(31, 34, headers[2]);
    assign(35, 37, firstCounters[2]);
    assign(38, 40, adds[2]);
    assign(41, 43, secondCounters[2]);
    mapping[44] = equals[2];
    assign(45, 50, answers);
    assign(51, 54, finalLine);
    return mapping;
  }

  function buildPage40ModelMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg040_p037" && sourceId !== "pg040_p038") return null;
    var model = source.closest(".place-model");
    var columns = model ? Array.from(model.querySelectorAll(".place-model-grid > div")) : [];
    if (columns.length !== 3) return null;

    function wordRange(element) {
      var tokens = element ? collectRootTokens(element, content) : [];
      return tokens[0] && tokens[0].range;
    }

    var headers = columns.map(function (column) { return wordRange(column.querySelector("h3")); });
    var firstCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[0]; });
    var secondCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[1]; });
    var adds = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[0]); });
    var equals = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[1]); });
    var answers = columns.map(function (column) { return column.querySelector(".model-answer"); });
    var finalLine = model.querySelector(".model-final");
    if ([headers, firstCounters, secondCounters, adds, equals, answers].some(function (items) { return items.some(function (item) { return !item; }); }) || !finalLine) return null;

    var mapping = new Array(narration.length).fill(null);
    function assign(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }

    assign(3, 6, headers[0]);
    assign(7, 9, firstCounters[0]);
    assign(10, 12, adds[0]);
    assign(13, 15, secondCounters[0]);
    mapping[16] = equals[0];
    assign(17, 20, headers[1]);
    assign(21, 23, firstCounters[1]);
    assign(24, 26, adds[1]);
    assign(27, 29, secondCounters[1]);
    mapping[30] = equals[1];
    assign(31, 34, headers[2]);
    assign(35, 37, firstCounters[2]);
    assign(38, 40, adds[2]);
    assign(41, 43, secondCounters[2]);
    mapping[44] = equals[2];
    assign(45, 50, answers);
    assign(51, 54, finalLine);
    return mapping;
  }

  function buildPage41ModelMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg041_p037" && sourceId !== "pg041_p038") return null;
    var model = source.closest(".place-model");
    var columns = model ? Array.from(model.querySelectorAll(".place-model-grid > div")) : [];
    if (columns.length !== 3) return null;

    function wordRange(element) {
      var tokens = element ? collectRootTokens(element, content) : [];
      return tokens[0] && tokens[0].range;
    }

    var headers = columns.map(function (column) { return wordRange(column.querySelector("h3")); });
    var firstCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[0]; });
    var secondCounters = columns.map(function (column) { return column.querySelectorAll(".counter-row")[1]; });
    var adds = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[0]); });
    var equals = columns.map(function (column) { return wordRange(column.querySelectorAll(".model-word")[1]); });
    var answers = columns.map(function (column) { return column.querySelector(".model-answer"); });
    var finalLine = model.querySelector(".model-final");
    if ([headers, firstCounters, secondCounters, adds, equals, answers].some(function (items) { return items.some(function (item) { return !item; }); }) || !finalLine) return null;

    var mapping = new Array(narration.length).fill(null);
    function assign(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }

    assign(3, 6, headers[0]);
    assign(7, 9, firstCounters[0]);
    assign(10, 12, adds[0]);
    assign(13, 15, secondCounters[0]);
    mapping[16] = equals[0];
    assign(17, 20, headers[1]);
    assign(21, 23, firstCounters[1]);
    assign(24, 26, adds[1]);
    assign(27, 29, secondCounters[1]);
    mapping[30] = equals[1];
    assign(31, 34, headers[2]);
    assign(35, 37, firstCounters[2]);
    assign(38, 40, adds[2]);
    assign(41, 43, secondCounters[2]);
    mapping[44] = equals[2];
    assign(45, 50, answers);
    assign(51, 54, finalLine);
    return mapping;
  }

  function buildPage45SolutionMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg045_p025" && sourceId !== "pg045_p053") return null;
    var solution = content.querySelector('[data-section-id="pg045_sec001"] .example-card .solution-pair > div:nth-child(2)');
    if (!solution) return null;

    var title = solution.querySelector("h2");
    var headings = Array.from(solution.querySelectorAll(".place-head > span"));
    var equation = solution.querySelector(".place-sum");
    var result = Array.from(solution.querySelectorAll('[data-id="pg045_p034"],[data-id="pg045_p035"],[data-id="pg045_p036"]'));
    if (!title || headings.length !== 3 || !equation || result.length !== 3) return null;

    function firstRange(element) {
      var token = collectRootTokens(element, content)[0];
      return token && token.range;
    }

    var titleRange = firstRange(title);
    var headingRanges = headings.map(firstRange);
    if (!titleRange || headingRanges.some(function (range) { return !range; })) return null;

    if (sourceId === "pg045_p025") {
      var shortTargets = {
        solution: titleRange,
        hundreds: headingRanges[0],
        tens: headingRanges[1],
        ones: headingRanges[2]
      };
      return narration.map(function (word) { return shortTargets[word] || null; });
    }

    return narration.map(function (word, index) {
      if (word === "solution") return titleRange;
      if (word === "hundreds") return headingRanges[0];
      if (word === "tens") return headingRanges[1];
      if (word === "ones") return headingRanges[2];
      if (index >= 1 && index <= 5) return equation;
      if (index >= 6 && index <= 16) return headings;
      if (index >= 17) return result;
      return null;
    });
  }

  function buildPage46ExerciseMap(content, source, narration) {
    if (source.getAttribute("data-id") !== "pg046_p079") return null;
    var section = content.querySelector('[data-section-id="pg046_sec001"] .exercise-card');
    var problems = section ? Array.from(section.querySelectorAll(".sum-problem")) : [];
    if (problems.length !== 6 || narration.length !== problems.length * 5) return null;

    function visibleRanges(elements) {
      var ranges = [];
      Array.from(elements).forEach(function (element) {
        var root = element.matches(".live-copy") ? element.querySelector(".visual-copy") : element;
        if (!root) return;
        collectRootTokens(root, content).forEach(function (token) { ranges.push(token.range); });
      });
      return ranges;
    }

    function firstRawRange(element) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var match = node.nodeValue && node.nodeValue.match(WORD_PATTERN);
        if (!match) continue;
        var start = node.nodeValue.indexOf(match[0]);
        var range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + match[0].length);
        return range;
      }
      return null;
    }

    var mapping = new Array(narration.length).fill(null);
    problems.forEach(function (problem, problemIndex) {
      var questionNumber = problem.querySelector(":scope > .question-number");
      var rows = problem.querySelectorAll(".sum-row");
      var plus = rows[1] && rows[1].querySelector(":scope > [data-id]");
      if (!questionNumber || rows.length !== 2 || !plus) return;
      var questionRange = collectRootTokens(questionNumber, content)[0];
      var firstNumberRanges = visibleRanges(rows[0].children);
      var plusRange = firstRawRange(plus);
      var secondNumberRanges = visibleRanges(Array.from(rows[1].children).filter(function (element) { return element !== plus; }));
      if (!questionRange || !plusRange || !firstNumberRanges.length || !secondNumberRanges.length) return;
      var offset = problemIndex * 5;
      mapping[offset] = questionRange.range;
      mapping[offset + 1] = questionRange.range;
      mapping[offset + 2] = firstNumberRanges;
      mapping[offset + 3] = plusRange;
      mapping[offset + 4] = secondNumberRanges;
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage47ExerciseMap(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg047_p171" && sourceId !== "pg047_p172") return null;
    var container = sourceId === "pg047_p171"
      ? source.closest(".continuation-card")
      : source.closest(".exercise-card");
    var problems = container ? Array.from(container.querySelectorAll(".sum-problem")) : [];
    if (!problems.length || narration.length !== problems.length * 5) return null;

    function visibleRanges(elements) {
      var ranges = [];
      Array.from(elements).forEach(function (element) {
        collectRootTokens(element, content).forEach(function (token) { ranges.push(token.range); });
      });
      return ranges;
    }

    function firstRawRange(element) {
      var walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var match = node.nodeValue && node.nodeValue.match(WORD_PATTERN);
        if (!match) continue;
        var start = node.nodeValue.indexOf(match[0]);
        var range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + match[0].length);
        return range;
      }
      return null;
    }

    var mapping = new Array(narration.length).fill(null);
    problems.forEach(function (problem, problemIndex) {
      var questionNumber = problem.querySelector(":scope > .question-number");
      var rows = problem.querySelectorAll(".sum-row");
      var plus = rows[1] && rows[1].querySelector(":scope > [data-id]");
      if (!questionNumber || rows.length !== 2 || !plus) return;
      var questionRange = collectRootTokens(questionNumber, content)[0];
      var firstNumberRanges = visibleRanges(rows[0].children);
      var plusRange = firstRawRange(plus);
      var secondNumberRanges = visibleRanges(Array.from(rows[1].children).filter(function (element) { return element !== plus; }));
      if (!questionRange || !plusRange || !firstNumberRanges.length || !secondNumberRanges.length) return;
      var offset = problemIndex * 5;
      mapping[offset] = questionRange.range;
      mapping[offset + 1] = questionRange.range;
      mapping[offset + 2] = firstNumberRanges;
      mapping[offset + 3] = plusRange;
      mapping[offset + 4] = secondNumberRanges;
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage48Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg048_p052" && sourceId !== "pg048_p053") return null;
    var section = content.querySelector('[data-section-id="pg048_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg048_p052") {
      var problems = Array.from(source.closest(".continuation-card").querySelectorAll(".sum-problem"));
      if (problems.length !== 3 || narration.length !== 15) return null;
      var questionMap = new Array(narration.length).fill(null);
      problems.forEach(function (problem, problemIndex) {
        var questionNumber = problem.querySelector(":scope > .question-number");
        var rows = problem.querySelectorAll(".sum-row");
        var plus = rows[1] && rows[1].querySelector(":scope > [data-id]");
        if (!questionNumber || rows.length !== 2 || !plus) return;
        var questionRanges = rawRanges(questionNumber);
        var firstNumberRanges = rawRanges(rows[0]);
        var plusRanges = rawRanges(plus);
        var secondNumberRanges = rawRanges(rows[1]).slice(1);
        if (!questionRanges.length || !firstNumberRanges.length || !plusRanges.length || !secondNumberRanges.length) return;
        var offset = problemIndex * 5;
        questionMap[offset] = questionRanges;
        questionMap[offset + 1] = questionRanges;
        questionMap[offset + 2] = firstNumberRanges;
        questionMap[offset + 3] = plusRanges;
        questionMap[offset + 4] = secondNumberRanges;
      });
      return questionMap.some(function (target) { return !target; }) ? null : questionMap;
    }

    if (narration.length !== 75) return null;
    var exampleMap = new Array(narration.length).fill(null);
    function assignRange(start, end, ranges) {
      if (ranges.length !== end - start + 1) return false;
      ranges.forEach(function (range, index) { exampleMap[start + index] = range; });
      return true;
    }
    function visualCopy(id) {
      var highlight = section.querySelector('.highlight-copy[data-id="' + id + '"]');
      var liveCopy = highlight && highlight.closest(".live-copy");
      return liveCopy && liveCopy.querySelector(".visual-copy");
    }

    var stepsHeading = rawRanges(section.querySelector('[data-id="pg048_p033"]'));
    var valid =
      assignRange(0, 3, rawRanges(section.querySelector('[data-id="pg048_p030"]'))) &&
      assignRange(4, 4, rawRanges(section.querySelector('[data-id="pg048_p031"]'))) &&
      assignRange(5, 9, rawRanges(section.querySelector('[data-id="pg048_p032"]'))) &&
      stepsHeading.length === 1 &&
      assignRange(12, 19, rawRanges(visualCopy("pg048_p034"))) &&
      assignRange(20, 23, rawRanges(visualCopy("pg048_p035"))) &&
      assignRange(24, 28, rawRanges(visualCopy("pg048_p036"))) &&
      assignRange(29, 34, rawRanges(visualCopy("pg048_p037"))) &&
      assignRange(35, 41, rawRanges(visualCopy("pg048_p038"))) &&
      assignRange(43, 52, rawRanges(visualCopy("pg048_p042"))) &&
      assignRange(53, 57, rawRanges(visualCopy("pg048_p043"))) &&
      assignRange(58, 62, rawRanges(visualCopy("pg048_p044"))) &&
      assignRange(63, 74, rawRanges(visualCopy("pg048_p045")));
    if (!valid) return null;
    exampleMap[10] = stepsHeading[0];
    exampleMap[11] = stepsHeading[0];
    exampleMap[42] = stepsHeading[0];
    return exampleMap.some(function (target) { return !target; }) ? null : exampleMap;
  }

  function buildPage49Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg049_p030" && sourceId !== "pg049_p031") return null;
    var section = content.querySelector('[data-section-id="pg049_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    function visualRanges(id) {
      var highlight = section.querySelector('.highlight-copy[data-id="' + id + '"]');
      var liveCopy = highlight && highlight.closest(".live-copy");
      var visualCopy = liveCopy && liveCopy.querySelector(".visual-copy");
      return visualCopy ? rawRanges(visualCopy) : [];
    }

    if (sourceId === "pg049_p030") {
      if (narration.length !== 22) return null;
      var firstStep = visualRanges("pg049_p001");
      var writtenAnswer = visualRanges("pg049_p002");
      var conclusion = rawRanges(section.querySelector('[data-id="pg049_p004"]'));
      if (firstStep.length !== 10 || writtenAnswer.length !== 6 || conclusion.length !== 5) return null;
      var stepMap = new Array(narration.length).fill(null);
      stepMap[0] = firstStep[0];
      stepMap[1] = firstStep[0];
      firstStep.slice(1).forEach(function (range, index) { stepMap[index + 2] = range; });
      writtenAnswer.forEach(function (range, index) { stepMap[index + 11] = range; });
      conclusion.forEach(function (range, index) { stepMap[index + 17] = range; });
      return stepMap.some(function (target) { return !target; }) ? null : stepMap;
    }

    if (narration.length !== 60) return null;
    var rows = Array.from(section.querySelectorAll(".answer-list .answer-row"));
    if (rows.length !== 10) return null;
    var questionMap = new Array(narration.length).fill(null);
    rows.forEach(function (row, rowIndex) {
      var ranges = Array.from(row.querySelectorAll(".visual-copy")).flatMap(rawRanges);
      if (ranges.length !== 5) return;
      var offset = rowIndex * 6;
      questionMap[offset] = ranges[0];
      questionMap[offset + 1] = ranges[0];
      questionMap[offset + 2] = ranges[1];
      questionMap[offset + 3] = ranges[2];
      questionMap[offset + 4] = ranges[3];
      questionMap[offset + 5] = ranges[4];
    });
    return questionMap.some(function (target) { return !target; }) ? null : questionMap;
  }

  function buildPage50Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg050_p068" && sourceId !== "pg050_p069") return null;
    var container = source.closest(".continuation-card,.exercise-card");
    if (!container) return null;
    var rows = Array.from(container.querySelectorAll(".answer-list .answer-row"));
    var expectedRows = sourceId === "pg050_p068" ? 10 : 20;
    if (rows.length !== expectedRows || narration.length !== expectedRows * 6) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    var mapping = new Array(narration.length).fill(null);
    rows.forEach(function (row, rowIndex) {
      var ranges = Array.from(row.querySelectorAll(".visual-copy")).flatMap(rawRanges);
      if (ranges.length !== 5) return;
      var offset = rowIndex * 6;
      mapping[offset] = ranges[0];
      mapping[offset + 1] = ranges[0];
      mapping[offset + 2] = ranges[1];
      mapping[offset + 3] = ranges[2];
      mapping[offset + 4] = ranges[3];
      mapping[offset + 5] = ranges[4];
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage51Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg051_p060" && sourceId !== "pg051_p061") return null;
    var section = content.querySelector('[data-section-id="pg051_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg051_p060") {
      if (narration.length !== 11) return null;
      var equationParts = Array.from(section.querySelectorAll(".solution-pair .compact-equation > span"));
      if (equationParts.length !== 3) return null;
      var instructionMap = new Array(narration.length).fill(null);
      instructionMap[0] = equationParts;
      instructionMap.fill(equationParts[0], 1, 5);
      instructionMap[5] = equationParts[1];
      instructionMap.fill(equationParts[2], 6, 10);
      instructionMap[10] = equationParts;
      return instructionMap;
    }

    if (narration.length !== 152) return null;

    function visualRanges(id) {
      var highlight = section.querySelector('.highlight-copy[data-id="' + id + '"]');
      var liveCopy = highlight && highlight.closest(".live-copy");
      var visualCopy = liveCopy && liveCopy.querySelector(".visual-copy");
      return visualCopy ? rawRanges(visualCopy) : [];
    }

    function byId(id) {
      return section.querySelector('[data-id="' + id + '"]');
    }

    var placeSum = section.querySelector(".solution-pair .place-sum");
    var solutionHeading = rawRanges(byId("pg051_p002"));
    var headings = rawRanges(section.querySelector(".solution-pair .place-head"));
    var firstRow = [byId("pg051_p011"), byId("pg051_p013"), byId("pg051_p015")];
    var secondRow = [byId("pg051_p012"), byId("pg051_p014"), byId("pg051_p016")];
    var plusSign = byId("pg051_p010");
    var answerRow = [byId("pg051_p017"), byId("pg051_p018"), byId("pg051_p019")];
    var stepsHeading = rawRanges(byId("pg051_p020"));
    var stepOne = visualRanges("pg051_p021");
    var regroup = visualRanges("pg051_p022");
    var writeOnes = visualRanges("pg051_p024");
    var stepTwo = visualRanges("pg051_p035");
    var writeTens = visualRanges("pg051_p036");
    var stepThree = visualRanges("pg051_p046");
    var writeHundreds = visualRanges("pg051_p047");
    var conclusion = rawRanges(byId("pg051_p057"));
    if (!placeSum || solutionHeading.length !== 1 || headings.length !== 3 || firstRow.some(function (item) { return !item; }) || secondRow.some(function (item) { return !item; }) || !plusSign || answerRow.some(function (item) { return !item; }) || stepsHeading.length !== 1 || stepOne.length !== 8 || regroup.length !== 9 || writeOnes.length !== 13 || stepTwo.length !== 10 || writeTens.length !== 6 || stepThree.length !== 8 || writeHundreds.length !== 6 || conclusion.length !== 5) return null;

    var mapping = new Array(narration.length).fill(null);
    function fill(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }
    function assign(start, ranges) {
      ranges.forEach(function (range, index) { mapping[start + index] = range; });
    }

    mapping[0] = solutionHeading[0];
    fill(1, 11, placeSum);
    mapping[3] = headings[0];
    mapping[4] = headings[1];
    mapping[5] = headings;
    mapping[6] = headings[2];
    fill(12, 15, firstRow);
    fill(16, 20, firstRow[0]);
    fill(21, 25, firstRow[1]);
    mapping[26] = firstRow;
    fill(27, 31, firstRow[2]);
    fill(32, 35, secondRow);
    fill(36, 40, secondRow[0]);
    fill(41, 45, secondRow[1]);
    mapping[46] = secondRow;
    fill(47, 51, secondRow[2]);
    fill(52, 59, plusSign);
    fill(60, 63, answerRow);
    fill(64, 68, answerRow[0]);
    fill(69, 73, answerRow[1]);
    mapping[74] = answerRow;
    fill(75, 79, answerRow[2]);
    mapping[80] = stepsHeading[0];
    mapping[81] = stepsHeading[0];
    assign(82, stepOne);
    assign(90, regroup);
    assign(99, writeOnes);
    mapping[112] = stepsHeading[0];
    assign(113, stepTwo);
    assign(123, writeTens);
    mapping[129] = stepsHeading[0];
    assign(130, stepThree);
    assign(138, writeHundreds);
    conclusion.slice(0, 4).forEach(function (range, index) { mapping[144 + index] = range; });
    fill(148, 151, conclusion[4]);
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage52Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg052_p065" && sourceId !== "pg052_p066") return null;
    var section = content.querySelector('[data-section-id="pg052_sec001"]');
    if (!section) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg052_p065") {
      if (narration.length !== 11) return null;
      var equation = rawRanges(section.querySelector(".worked-top .top-sum"));
      if (equation.length !== 3) return null;
      var instructionMap = new Array(narration.length).fill(null);
      instructionMap[0] = equation;
      instructionMap.fill(equation[0], 1, 5);
      instructionMap[5] = equation[1];
      instructionMap.fill(equation[2], 6, 10);
      instructionMap[10] = equation;
      return instructionMap;
    }

    if (narration.length !== 169) return null;
    var placeSum = section.querySelector(".place-solution .place-sum");
    var labels = rawRanges(placeSum && placeSum.querySelector(".labels"));
    var rows = placeSum ? Array.from(placeSum.querySelectorAll(".row")) : [];
    var firstRow = rows[0] ? Array.from(rows[0].querySelectorAll("span")).slice(1) : [];
    var secondRow = rows[1] ? Array.from(rows[1].querySelectorAll("span")) : [];
    var plusSign = rows[1] && rows[1].querySelector("b");
    var answerRow = rows[2] ? Array.from(rows[2].querySelectorAll("span")).slice(1) : [];
    var stepsHeading = rawRanges(section.querySelector(".steps-title"));
    var stepRows = Array.from(section.querySelectorAll(".step-row"));
    var stepOne = stepRows[0] && rawRanges(stepRows[0].querySelector(".step-lead"));
    var stepOneCopy = stepRows[0] && rawRanges(stepRows[0].querySelector(".step-copy p:nth-child(2)"));
    var stepTwo = stepRows[1] && rawRanges(stepRows[1].querySelector(".step-lead"));
    var stepTwoCopy = stepRows[1] && rawRanges(stepRows[1].querySelector(".step-copy p:nth-child(2)"));
    var stepThree = stepRows[2] && rawRanges(stepRows[2].querySelector(".step-lead"));
    var stepThreeCopy = stepRows[2] && rawRanges(stepRows[2].querySelector(".step-copy p:nth-child(2)"));
    var conclusion = rawRanges(section.querySelector(".therefore"));
    if (!placeSum || labels.length !== 3 || firstRow.length !== 3 || secondRow.length !== 3 || !plusSign || answerRow.length !== 3 || stepsHeading.length !== 1 || !stepOne || stepOne.length !== 8 || !stepOneCopy || stepOneCopy.length !== 22 || !stepTwo || stepTwo.length !== 10 || !stepTwoCopy || stepTwoCopy.length !== 22 || !stepThree || stepThree.length !== 10 || !stepThreeCopy || stepThreeCopy.length !== 6 || conclusion.length !== 5) return null;

    var mapping = new Array(narration.length).fill(null);
    function fill(start, end, target) {
      for (var index = start; index <= end; index += 1) mapping[index] = target;
    }
    function assign(start, ranges) {
      ranges.forEach(function (range, index) { mapping[start + index] = range; });
    }

    fill(0, 10, placeSum);
    mapping[2] = labels[0];
    mapping[3] = labels[1];
    mapping[4] = labels;
    mapping[5] = labels[2];
    fill(11, 14, firstRow);
    fill(15, 19, firstRow[0]);
    fill(20, 24, firstRow[1]);
    mapping[25] = firstRow;
    fill(26, 30, firstRow[2]);
    fill(31, 34, secondRow);
    fill(35, 39, secondRow[0]);
    fill(40, 44, secondRow[1]);
    mapping[45] = secondRow;
    fill(46, 50, secondRow[2]);
    fill(51, 58, plusSign);
    fill(59, 62, answerRow);
    fill(63, 67, answerRow[0]);
    fill(68, 72, answerRow[1]);
    mapping[73] = answerRow;
    fill(74, 78, answerRow[2]);
    mapping[79] = stepsHeading[0];
    mapping[80] = stepsHeading[0];
    assign(81, stepOne);
    assign(89, stepOneCopy);
    mapping[111] = stepsHeading[0];
    assign(112, stepTwo);
    assign(122, stepTwoCopy);
    mapping[144] = stepsHeading[0];
    assign(145, stepThree);
    assign(155, stepThreeCopy);
    conclusion.slice(0, 4).forEach(function (range, index) { mapping[161 + index] = range; });
    fill(165, 168, conclusion[4]);
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildPage53Exercise8Map(content, source, narration) {
    var sourceId = source.getAttribute("data-id");
    if (sourceId !== "pg053_p119" && sourceId !== "pg053_p120" && sourceId !== "pg053_p148") return null;
    var section = content.querySelector('[data-section-id="pg053_sec001"]');
    var exercise = section && section.querySelector(".pg053-eight");
    if (!exercise) return null;

    function rawRanges(root) {
      var ranges = [];
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        if (excludedTextNode(node, content)) continue;
        var pattern = new RegExp(WORD_PATTERN.source, "gu");
        var match;
        while ((match = pattern.exec(node.nodeValue || ""))) {
          var range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          ranges.push(range);
        }
      }
      return ranges;
    }

    if (sourceId === "pg053_p119") {
      var heading = rawRanges(exercise.querySelector(".pg053-label"));
      return narration.length === 2 && heading.length === 2 ? heading : null;
    }
    if (sourceId === "pg053_p120") {
      var instruction = rawRanges(exercise.querySelector(".pg053-intro"));
      return narration.length === 6 && instruction.length === 6 ? instruction : null;
    }
    if (narration.length !== 15) return null;
    var rows = Array.from(exercise.querySelectorAll(".pg053-problem"));
    if (rows.length !== 3) return null;

    var mapping = new Array(narration.length).fill(null);
    rows.forEach(function (row, rowIndex) {
      var ranges = rawRanges(row);
      if (ranges.length !== 4) return;
      var offset = rowIndex * 5;
      mapping[offset] = ranges[0];
      mapping[offset + 1] = ranges[0];
      mapping[offset + 2] = ranges[1];
      mapping[offset + 3] = ranges[2];
      mapping[offset + 4] = ranges[3];
    });
    return mapping.some(function (target) { return !target; }) ? null : mapping;
  }

  function buildMap(content, source) {
    var narration = collectNarrationTokens(source);
    return buildPage23TableMap(content, source, narration) || buildPage24AnswerBlankMap(content, source, narration) || buildPage25AnswerBlankMap(content, source, narration) || buildPage27AnswerBlankMap(content, source, narration) || buildPage28ExerciseRowMap(content, source, narration) || buildPage29ExerciseDiagramMap(content, source, narration) || buildPage30ExerciseMap(content, source, narration) || buildPage31AnswerBlankMap(content, source, narration) || buildPage36TableMap(content, source, narration) || buildPage37ChapterBannerMap(content, source, narration) || buildPage37ExampleMap(content, source, narration) || buildPage39ModelMap(content, source, narration) || buildPage40ModelMap(content, source, narration) || buildPage41ModelMap(content, source, narration) || buildPage45SolutionMap(content, source, narration) || buildPage46ExerciseMap(content, source, narration) || buildPage47ExerciseMap(content, source, narration) || buildPage48Map(content, source, narration) || buildPage49Map(content, source, narration) || buildPage50Map(content, source, narration) || buildPage51Map(content, source, narration) || buildPage52Map(content, source, narration) || buildPage53Exercise8Map(content, source, narration) || buildPage94ShareMap(content, source, narration) || alignTokens(narration, collectVisibleTokens(content));
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
    var hasElementTarget = ranges.some(function (item) {
      return item && item.nodeType === Node.ELEMENT_NODE;
    });
    if (!hasElementTarget && window.CSS && CSS.highlights && typeof window.Highlight === "function") {
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
    syncPage36InstructionHighlight(content);
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
