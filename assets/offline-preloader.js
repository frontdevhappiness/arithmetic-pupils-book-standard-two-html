// Load the large inline resource payload only for direct offline file use.
// HTTP previews fetch resources normally, avoiding a multi-megabyte parse on every page.
(function () {
  if (location.protocol === "file:") {
    document.write('<script src="./assets/offline-data.js"><\/script>');
  }

  function labelGlossaryDialog() {
    var glossaryButton = Array.from(document.querySelectorAll("#nav-container button")).find(
      function (button) {
        return /glossary/i.test(button.getAttribute("aria-label") || "");
      }
    );
    if (!glossaryButton) return;

    document.querySelectorAll('[role="dialog"]:not([aria-label]):not([aria-labelledby])').forEach(
      function (dialog) {
        var tabs = Array.from(dialog.querySelectorAll('[role="tab"]')).map(function (tab) {
          return tab.textContent.trim().toLowerCase();
        });
        if (tabs.indexOf("on this page") === -1 || tabs.indexOf("book glossary") === -1) return;
        dialog.setAttribute("aria-label", glossaryButton.getAttribute("aria-label") || "Glossary");
      }
    );
  }

  new MutationObserver(labelGlossaryDialog).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  labelGlossaryDialog();
})();
