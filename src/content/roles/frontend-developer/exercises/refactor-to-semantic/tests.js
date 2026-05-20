// Assertions for the "refactor-to-semantic" exercise. The globals injected
// by RoleRoadmap (see src/lib/sandpack/globals.ts) provide:
//   __report({ ok, message })
//   assertHasElement(selector)

(function () {
  function run() {
    try {
      assertHasElement("header");
      assertHasElement("header h1");
      assertHasElement("header nav");
      assertHasElement("nav a[href='/']");
      assertHasElement("nav a[href='/about']");
      assertHasElement("article");
      assertHasElement("article h2");
      assertHasElement("footer");

      // Make sure the user actually replaced the divs — no more class-driven
      // "header"/"nav"/"footer" leftovers in the body.
      var staleHeader = document.querySelector("div.header");
      var staleNav = document.querySelector("div.nav");
      var staleFooter = document.querySelector("div.footer");
      if (staleHeader || staleNav || staleFooter) {
        throw new Error(
          "Replace .header / .nav / .footer divs with real <header>, <nav>, <footer> tags",
        );
      }
      __report({ ok: true, message: "Semantic landmarks in place." });
    } catch (err) {
      __report({ ok: false, message: err.message });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
