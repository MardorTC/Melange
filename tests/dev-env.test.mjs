import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/dev-env.sh", import.meta.url));
function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "melange env "));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, ".tools/jdk/bin"), { recursive: true });
  mkdirSync(path.join(root, ".tools/android"), { recursive: true });
  writeFileSync(path.join(root, ".tools/jdk/bin/java"), "", { mode: 0o755 });
  return root;
}
function resolve(root, overrides = {}) {
  const env = { ...process.env };
  for (const key of [
    "JAVA_HOME",
    "ANDROID_HOME",
    "ANDROID_SDK_ROOT",
    "GRADLE_USER_HOME",
    "PLAYWRIGHT_BROWSERS_PATH",
    "CI",
  ])
    delete env[key];
  Object.assign(env, { MELANGE_ROOT: root }, overrides);
  return JSON.parse(
    execFileSync(
      "sh",
      [
        "-c",
        '. "$1"; exec "$2" -e "console.log(JSON.stringify(process.env))"',
        "env-test",
        script,
        process.execPath,
      ],
      { env, encoding: "utf8" },
    ),
  );
}
test("local tools work from paths containing spaces", (t) => {
  const root = fixture(t),
    env = resolve(root);
  assert.equal(env.JAVA_HOME, path.join(root, ".tools/jdk"));
  assert.equal(env.ANDROID_HOME, path.join(root, ".tools/android"));
  assert.equal(env.ANDROID_SDK_ROOT, env.ANDROID_HOME);
  assert.equal(
    env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(root, ".tools/browsers"),
  );
  assert.equal(env.GRADLE_USER_HOME, path.join(root, ".tools/gradle-home"));
  assert.ok(env.PATH.startsWith(env.JAVA_HOME + "/bin:"));
});
test("explicit tool paths and caches take precedence", (t) => {
  const overrides = {
    JAVA_HOME: "/custom/java",
    ANDROID_HOME: "/custom/sdk",
    ANDROID_SDK_ROOT: "/old/sdk",
    GRADLE_USER_HOME: "/custom/gradle",
    PLAYWRIGHT_BROWSERS_PATH: "0",
  };
  const env = resolve(fixture(t), overrides);
  for (const key of [
    "JAVA_HOME",
    "ANDROID_HOME",
    "GRADLE_USER_HOME",
    "PLAYWRIGHT_BROWSERS_PATH",
  ])
    assert.equal(env[key], overrides[key]);
  assert.equal(env.ANDROID_SDK_ROOT, overrides.ANDROID_HOME);
});
test("legacy SDK variable is supported and CI retains default caches", (t) => {
  const env = resolve(fixture(t), { ANDROID_SDK_ROOT: "/ci/sdk", CI: "true" });
  assert.equal(env.ANDROID_HOME, "/ci/sdk");
  assert.equal(env.GRADLE_USER_HOME, undefined);
  assert.equal(env.PLAYWRIGHT_BROWSERS_PATH, undefined);
});
