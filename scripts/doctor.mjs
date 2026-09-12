import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

let failures = 0;
function check(label, ok, hint) {
  console.log(`${ok ? "OK" : "FALTA"} · ${label}${ok ? "" : ` — ${hint}`}`);
  if (!ok) failures++;
}
function command(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return {
    ok: !result.error && result.status === 0,
    text: `${result.stdout || ""}${result.stderr || ""}`,
  };
}
check(
  "Node.js 24",
  process.versions.node.split(".")[0] === "24",
  "Usa nvm install y nvm use (archivo .nvmrc).",
);
check("Git", command("git", ["--version"]).ok, "Instala Git.");
check(
  "Dependencias npm",
  existsSync("node_modules/playwright/package.json"),
  "Ejecuta npm ci.",
);
try {
  const { chromium } = await import("playwright");
  check(
    "Chromium de pruebas",
    existsSync(process.env.OSP_CHROME || chromium.executablePath()),
    "Ejecuta npm run setup:browsers.",
  );
} catch {
  check("Chromium de pruebas", false, "Ejecuta npm run setup.");
}
const java = command("java", ["-version"]);
check(
  "JDK 17",
  java.ok &&
    /version "17[."]/.test(java.text) &&
    command("javac", ["-version"]).ok,
  "Instala JDK 17 en .tools/jdk o configura JAVA_HOME.",
);
const sdk = process.env.ANDROID_HOME;
check(
  "SDK Android",
  !!sdk && existsSync(sdk),
  "Instala el SDK en .tools/android o configura ANDROID_HOME.",
);
for (const file of [
  "platforms/android-35/android.jar",
  "build-tools/35.0.0/apksigner",
  "platform-tools/adb",
]) {
  check(
    file,
    !!sdk && existsSync(path.join(sdk, file)),
    'Instala "platforms;android-35", "build-tools;35.0.0" y "platform-tools" con sdkmanager.',
  );
}
console.log(
  `\nJava: ${process.env.JAVA_HOME || "PATH del sistema"}\nAndroid: ${sdk || "sin configurar"}\nGradle: ${process.env.GRADLE_USER_HOME || "caché del sistema"}\nNavegadores: ${process.env.PLAYWRIGHT_BROWSERS_PATH || "caché del sistema"}`,
);

if (process.argv.includes("--release")) {
  check("GitHub CLI", command("gh", ["--version"]).ok, "Instala gh.");
  check(
    "Sesión GitHub",
    command("gh", ["auth", "status"]).ok,
    "Ejecuta gh auth login.",
  );
  const signing = process.env.OSP_SIGNING_DIR || "firma/signing";
  for (const file of ["projectosp.jks", "password.txt"]) {
    check(
      `Firma: ${file}`,
      existsSync(path.join(signing, file)),
      "Restaura la firma original o configura OSP_SIGNING_DIR.",
    );
  }
  console.log(
    "La publicación verifica la firma del APK y exige main, árbol limpio y una versión nueva.",
  );
}
console.log(
  failures
    ? `\nHay ${failures} requisito(s) pendiente(s). Consulta docs/entorno.md.`
    : "\nEntorno listo. No necesitas exportar variables para los comandos del proyecto.",
);
process.exitCode = failures ? 1 : 0;
