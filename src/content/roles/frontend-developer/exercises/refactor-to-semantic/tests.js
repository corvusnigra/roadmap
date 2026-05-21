// Проверки для упражнения "refactor-to-semantic". RoleRoadmap инжектит
// глобальные хелперы (см. src/lib/sandpack/globals.ts):
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

      // Убедимся, что пользователь действительно заменил div'ы — никаких
      // остатков "header"/"nav"/"footer" по классу.
      var staleHeader = document.querySelector("div.header");
      var staleNav = document.querySelector("div.nav");
      var staleFooter = document.querySelector("div.footer");
      if (staleHeader || staleNav || staleFooter) {
        throw new Error(
          "Замените div'ы .header / .nav / .footer на настоящие теги <header>, <nav>, <footer>",
        );
      }
      __report({ ok: true, message: "Семантические landmark'и на месте." });
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
