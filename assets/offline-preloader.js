// Load the large inline resource payload only for direct offline file use.
// HTTP previews fetch resources normally, avoiding an 8.5 MB parse on every page.
(function () {
  if (location.protocol === "file:") {
    document.write('<script src="./assets/offline-data.js"><\/script>');
  }
})();
