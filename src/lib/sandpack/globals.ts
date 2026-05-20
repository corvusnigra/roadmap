/**
 * Source of `/globals.js` that gets injected into every Sandpack exercise
 * iframe. Authors call these helpers from their `tests.js`. Keep this file
 * narrow — it ships into untrusted code execution territory and we want a
 * small attack surface.
 */
export const EXERCISE_GLOBALS_JS = `
(function () {
  var SOURCE = ${JSON.stringify("rr-exercise")};

  function report(payload) {
    try {
      window.parent.postMessage(Object.assign({ source: SOURCE, kind: "result" }, payload), "*");
    } catch (e) { /* parent gone */ }
  }
  window.__report = report;

  window.assertHasElement = function (sel) {
    if (!document.querySelector(sel)) {
      throw new Error("Expected to find element matching " + sel);
    }
  };

  window.assertEqual = function (actual, expected, hint) {
    if (actual !== expected) {
      var msg = "Expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual);
      if (hint) msg = hint + " — " + msg;
      throw new Error(msg);
    }
  };

  window.assertCssMatches = function (sel, prop, expected) {
    var el = document.querySelector(sel);
    if (!el) throw new Error("Expected to find element matching " + sel);
    var got = window.getComputedStyle(el).getPropertyValue(prop);
    if (got !== expected) {
      throw new Error(prop + " on " + sel + " expected " + expected + ", got " + got);
    }
  };

  // Announce that the user's code finished loading — useful for the parent
  // to distinguish "tests didn't post anything" from "iframe never booted".
  try {
    window.parent.postMessage({ source: SOURCE, kind: "booted" }, "*");
  } catch (e) { /* parent gone */ }
})();
`;
