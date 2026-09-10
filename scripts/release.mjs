import { execFileSync, spawnSync } from "node:child_process";
import {
  readFileSync,
  mkdirSync,
  copyFileSync,
  statSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const repo = "MardorTC/Melange";
const output = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8" }).trim();
const run = (cmd, args) => {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw Error(`${cmd} terminó con error (${result.status})`);
};
function clean() {
  if (output("git", ["status", "--porcelain"]))
    throw Error(
      "Publicación cancelada: el árbol de trabajo debe estar limpio.",
    );
}
try {
  clean();
  if (output("git", ["branch", "--show-current"]) !== "main")
    throw Error("Publica desde main.");
  if (
    output("git", ["remote", "get-url", "origin"]) !==
    "git@github.com:MardorTC/Melange.git"
  )
    throw Error("El remoto origin no es el repositorio esperado.");
  const tracked = output("git", ["ls-files"]).split("\n");
  if (
    tracked.some((file) =>
      /(^|\/)(firma|signing)\/|\.(jks|keystore|pem|key)$|(^|\/)password\.txt$/i.test(
        file,
      ),
    )
  )
    throw Error("Hay archivos privados versionados.");
  run("npm", ["run", "check"]);
  run("npm", ["run", "test:ui"]);
  run("./gradlew", [
    ":app:testDebugUnitTest",
    ":app:lintDebug",
    ":app:assembleDebug",
    ":app:assembleRelease",
  ]);
  const metadata = JSON.parse(
    readFileSync("app/build/generated/melangeAssets/version.json", "utf8"),
  );
  const tag = "v" + metadata.version;
  const notes = `docs/releases/${metadata.version}.md`;
  if (!existsSync(notes)) throw Error("Faltan las notas de release: " + notes);
  const releases = JSON.parse(
    output("gh", [
      "api",
      "--paginate",
      "--slurp",
      `repos/${repo}/releases`,
      "--jq",
      "[.[][] | .tag_name]",
    ]).replace(/\]\s*\[/g, ","),
  );
  if (releases.includes(tag))
    throw Error("Esa release ya existe; no se reemplazará.");
  if (
    output("git", ["tag", "--list", tag]) ||
    output("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`])
  )
    throw Error("La etiqueta ya existe; no se reemplazará.");
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw Error("Define ANDROID_HOME.");
  const source = "app/build/outputs/apk/release/app-release.apk";
  run(path.join(sdk, "build-tools/35.0.0/apksigner"), [
    "verify",
    "--verbose",
    source,
  ]);
  const directory = `build/releases/${tag}`;
  mkdirSync(directory, { recursive: true });
  const name = `Melange-${metadata.version}.apk`,
    apk = path.join(directory, name);
  copyFileSync(source, apk);
  const descriptor = {
    ...metadata,
    apk: name,
    size: statSync(apk).size,
    sha256: createHash("sha256").update(readFileSync(apk)).digest("hex"),
  };
  const json = path.join(directory, "update.json");
  writeFileSync(json, JSON.stringify(descriptor, null, 2) + "\n");
  clean();
  run("git", ["push", "-u", "origin", "main"]);
  run("git", ["tag", "-a", tag, "-m", `Melange ${metadata.version}`]);
  run("git", ["push", "origin", `refs/tags/${tag}`]);
  run("gh", [
    "release",
    "create",
    tag,
    "--repo",
    repo,
    "--verify-tag",
    "--draft",
    "--title",
    `Melange ${metadata.version}`,
    "--notes-file",
    notes,
  ]);
  run("gh", ["release", "upload", tag, apk, json, "--repo", repo]);
  const release = JSON.parse(
    output("gh", ["release", "view", tag, "--repo", repo, "--json", "assets"]),
  );
  for (const [name, size] of [
    [descriptor.apk, descriptor.size],
    ["update.json", statSync(json).size],
  ])
    if (
      !release.assets.some(
        (asset) => asset.name === name && asset.size === size,
      )
    )
      throw Error(
        "Los assets publicados no coinciden; la release permanece en borrador.",
      );
  run("gh", [
    "release",
    "edit",
    tag,
    "--repo",
    repo,
    "--draft=false",
    "--latest",
  ]);
  console.log(
    `Release publicada: https://github.com/${repo}/releases/tag/${tag}`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
