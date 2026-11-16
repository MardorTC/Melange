// Applies Día or Noche before the first paint. Classic script: it must run
// synchronously from <head>, before the stylesheets and the module graph.
// The choice is a display preference of this device, never part of the ledger.
(function () {
  var KEY = "melange.appearance";
  var media = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  function preference() {
    try {
      var value = window.localStorage.getItem(KEY);
      return value === "dia" || value === "noche" ? value : "auto";
    } catch (error) {
      return "auto";
    }
  }

  function systemDark() {
    try {
      if (window.NativeOSP && window.NativeOSP.systemDark)
        return Boolean(window.NativeOSP.systemDark());
    } catch (error) {
      // Fall back to the browser preference.
    }
    return Boolean(media && media.matches);
  }

  function apply(choice) {
    var value = choice || preference();
    var theme =
      value === "noche" || (value === "auto" && systemDark()) ? "noche" : "dia";
    document.documentElement.dataset.theme = theme;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta)
      meta.setAttribute("content", theme === "noche" ? "#121219" : "#f3ece1");
    try {
      if (window.NativeOSP && window.NativeOSP.setSystemTheme)
        window.NativeOSP.setSystemTheme(theme === "noche");
    } catch (error) {
      // System bars keep their previous color.
    }
    return theme;
  }

  window.melangeAppearance = {
    get: preference,
    set: function (value) {
      try {
        if (value === "auto") window.localStorage.removeItem(KEY);
        else window.localStorage.setItem(KEY, value);
      } catch (error) {
        // Without storage the choice lasts until the app closes.
      }
      return apply(value);
    },
    apply: apply,
  };

  apply();
  if (media && media.addEventListener)
    media.addEventListener("change", function () {
      if (preference() === "auto") apply();
    });
})();
