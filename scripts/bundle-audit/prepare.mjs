import assert from "node:assert/strict";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [variant, snapshot, output] = process.argv.slice(2);
const root = resolve(snapshot);
const configFile = join(root, "vite.config.ts");

if (variant === "hls-light") {
  // Keep the original import (and its types); only Vite resolves it differently.
  const config = readFileSync(configFile, "utf8");
  const marker = "  resolve: {\n";
  assert.equal(config.split(marker).length, 2, "Expected one Vite resolve block");
  assert.doesNotMatch(config, /\balias\s*:/, "Merge HLS alias with existing aliases");
  writeFileSync(
    configFile,
    config.replace(
      marker,
      `${marker}    alias: [{ find: /^hls\\.js$/, replacement: "hls.js/light" }],\n`,
    ),
  );
} else {
  assert.equal(variant, "compiler-subpath");
  process.chdir(root);
  const outDir = resolve(output);
  const require = createRequire(join(root, "package.json"));
  const { build, loadConfigFromFile, mergeConfig } = await import(
    pathToFileURL(require.resolve("vite"))
  );
  const { config } = await loadConfigFromFile(
    { command: "build", mode: "production" },
    configFile,
    root,
  );
  const filename = "compile-cut-list.js";
  const types = "./dist/utils/compileCutList.d.ts";
  assert.ok(existsSync(join(root, types)), "Normal release must supply the compiler declaration");

  const settings = mergeConfig(config, {
    configFile: false,
    root,
    mode: "production",
    build: {
      outDir,
      copyPublicDir: false,
      lib: { entry: join(root, "src/utils/compileCutList.ts"), fileName: () => filename },
    },
  });
  // Reuse declarations already emitted by the normal release. Do not write to dist
  // during the isolated Vite build, or inherit the root's React peer externals.
  settings.plugins = settings.plugins
    .flat(Infinity)
    .filter((plugin) => !/^unplugin[:-]dts$/.test(plugin?.name ?? ""));
  settings.build.rolldownOptions.external = [];
  const result = await build(settings);
  const bundle = (Array.isArray(result) ? result : [result]).flatMap((out) => out.output);
  const chunks = bundle.filter((file) => file.type === "chunk");
  assert.ok(chunks.some((file) => file.isEntry && file.fileName === filename));
  const emittedChunks = new Set(chunks.map((file) => file.fileName));
  for (const chunk of chunks) {
    for (const dependency of [...chunk.imports, ...chunk.dynamicImports]) {
      assert.ok(emittedChunks.has(dependency), `Unexpected compiler external: ${dependency}`);
    }
    for (const id of Object.keys(chunk.modules)) {
      assert.doesNotMatch(
        id.replaceAll("\\", "/"),
        /\/(?:src\/components|node_modules\/(?:react(?:-dom)?|hls\.js|@keplar-404))\//,
        `Unexpected UI module in compiler-only build: ${id}`,
      );
    }
  }

  for (const file of bundle) {
    assert.match(file.fileName, /\.[cm]?js(?:\.map)?$/, "Expected only compiler JS and maps");
    const destination = join(root, "dist", file.fileName);
    assert.ok(!existsSync(destination), `Refusing to replace release file: ${file.fileName}`);
    copyFileSync(join(outDir, file.fileName), destination);
  }
  const manifest = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  assert.ok(!Object.hasOwn(pkg.exports, "./compile-cut-list"));
  pkg.exports["./compile-cut-list"] = { types, import: `./dist/${filename}` };
  writeFileSync(manifest, `${JSON.stringify(pkg, null, 2)}\n`);
}
