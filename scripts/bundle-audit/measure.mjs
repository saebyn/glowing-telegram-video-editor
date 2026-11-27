import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const run = resolve(process.argv[2]);
const require = createRequire(join(run, "driver.cjs"));
const { decode } = require("@jridgewell/sourcemap-codec");
const { build } = await import(pathToFileURL(require.resolve("vite")));
const pkg = "@saebyn/glowing-telegram-video-editor";
const compilerSubpath = "./compile-cut-list";
const compilerEntry = (importLine) => `
${importLine}
const frameRate = { numerator: 30, denominator: 1 };
const sequence = { durationFrames: 0, tracks: [] };
document.querySelector("#app").textContent = JSON.stringify(compileCutList(sequence, [], {}, frameRate));
`;
const fixtures = {
  "source-review": `
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { VideoSelectionPage } from "${pkg}";
import "${pkg}/styles.css";
const content = {
  sourceId: "example", title: "Source review", video_url: "/asset.m3u8",
  frameRate: { numerator: 30, denominator: 1 }, durationFrames: 60,
  highlights: [], attentions: [], transcription_errors: [],
  silences: [], chat_history: [], transcript: [],
};
createRoot(document.querySelector("#app")).render(createElement(VideoSelectionPage, { content }));
`,
  "sequence-editor": `
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ProjectProvider, SequenceEditorPage } from "${pkg}";
import "${pkg}/styles.css";
const frameRate = { numerator: 30, denominator: 1 };
const sequence = { durationFrames: 0, tracks: [{ id: "track", label: "Track", placements: [] }] };
createRoot(document.querySelector("#app")).render(createElement(ProjectProvider, { frameRate },
  createElement(SequenceEditorPage, { sequence, clips: [], sources: {} })));
`,
  "compile-cut-list": compilerEntry(`import { compileCutList } from "${pkg}";`),
  "custom-css-import": `import "${pkg}/custom-only.css";`,
};

function gzip(content) {
  return execFileSync("gzip", ["-n", "-9", "-c"], {
    input: content,
    maxBuffer: 64 * 1024 * 1024,
  }).length;
}

function sizes(content) {
  return { raw: content.length, gzip: gzip(content) };
}

function addSizes(first, second) {
  return { raw: first.raw + second.raw, gzip: first.gzip + second.gzip };
}

function measureFiles(root, names) {
  return Object.fromEntries(
    names.sort().map((name) => [name, sizes(readFileSync(join(root, name)))]),
  );
}

function sumSizes(files) {
  return files.reduce(addSizes, { raw: 0, gzip: 0 });
}

function difference(first, second) {
  return { raw: first.raw - second.raw, gzip: first.gzip - second.gzip };
}

function packedDistSource(path) {
  const portable = path.replaceAll("\\", "/");
  return portable.includes(`/node_modules/${pkg}/dist/`) && /\.[cm]?js$/.test(basename(portable));
}

function bucket(source) {
  const path = source.replaceAll("\\", "/");
  // Keplar already bundles its own transitives into dist/index.es.js, with no upstream map.
  if (/(^|\/)node_modules\/hls\.js\//.test(path)) return "HLS.js (incl. vendored code)";
  if (/(^|\/)node_modules\/@keplar-404\//.test(path)) return "Keplar (incl. vendored code)";
  if (/(^|\/)node_modules\/temporal-(?:polyfill|utils|spec)\//.test(path)) return "Temporal";
  if (/(^|\/)node_modules\/(?:react|react-dom|scheduler)\//.test(path))
    return "React / React DOM / Scheduler";
  if (packedDistSource(path)) return "Editor package (opaque map)";
  if (/(^|\/)node_modules\/@saebyn\/glowing-telegram-video-editor\/src\//.test(path))
    return "Editor code";
  if (/(^|\/)node_modules\//.test(path)) return "Other dependency";
  if (/^(\.\.\/)*src\//.test(path)) return "Editor code";
  return "Other mapped (incl. fixture)";
}

function loadMap(path) {
  const map = JSON.parse(readFileSync(path, "utf8"));
  assert.ok(!map.sections, `Expected flat source map: ${path}`);
  return { sources: map.sources, mappings: decode(map.mappings) };
}

function originalBucket(map, line, column) {
  const segments = map.mappings[line] ?? [];
  // Greatest mapped position <= the original position in the release JS.
  let low = 0;
  let high = segments.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (segments[middle][0] <= column) low = middle + 1;
    else high = middle;
  }
  const index = segments[low - 1]?.[1];
  return index === undefined ? "Unmapped/generated" : bucket(map.sources[index]);
}

function attribution(root, files) {
  // Estimate only: next generated mapping on the same line bounds each span.
  // Generated columns are UTF-16; byte counts are UTF-8. Line endings,
  // unmapped prefixes, and one-field segments are counted separately.
  // Compressed buckets are isolated concatenations of spans, NOT additive.
  const unmapped = "Unmapped/generated";
  const spans = new Map();
  const upstreamMaps = new Map();
  function accumulate(key, text) {
    if (!text) return;
    if (!spans.has(key)) spans.set(key, []);
    spans.get(key).push(text);
  }
  let expected = 0;
  for (const file of files.sort()) {
    const code = readFileSync(join(root, file));
    expected += code.length;
    const mapPath = join(root, `${file}.map`);
    if (!existsSync(mapPath)) {
      // Vite can emit a mapless bootstrap in the CSS-only fixture.
      accumulate(unmapped, code.toString("utf8"));
      continue;
    }
    const map = loadMap(mapPath);
    const lines = code.toString("utf8").split("\n");
    const buckets = map.sources.map(bucket);
    const upstreams = map.sources.map((source) => {
      if (!packedDistSource(source)) return;
      // Consumer Vite doesn't automatically chain dist's source map. Chain
      // original line/column through the *packed* map without altering builds.
      const upstreamPath = resolve(dirname(mapPath), `${source}.map`);
      if (!upstreamMaps.has(upstreamPath) && existsSync(upstreamPath)) {
        upstreamMaps.set(upstreamPath, loadMap(upstreamPath));
      }
      return upstreamMaps.get(upstreamPath);
    });
    for (const [lineNo, line] of lines.entries()) {
      const segments = map.mappings[lineNo] ?? [];
      accumulate(unmapped, line.slice(0, segments[0]?.[0] ?? line.length));
      for (const [i, [start, source, originalLine, originalColumn]] of segments.entries()) {
        const end = segments[i + 1]?.[0] ?? line.length;
        const upstream = upstreams[source];
        const key = upstream
          ? originalBucket(upstream, originalLine, originalColumn)
          : source === undefined
            ? unmapped
            : buckets[source];
        accumulate(key, line.slice(start, end));
      }
      if (lineNo < lines.length - 1) accumulate(unmapped, "\n");
    }
  }
  const estimates = Object.fromEntries(
    [...spans.entries()]
      .map(([key, strings]) => {
        const content = Buffer.from(strings.join(""));
        return [key, { raw: content.length, isolatedGzip: gzip(content) }];
      })
      .sort((a, b) => b[1].raw - a[1].raw),
  );
  assert.equal(
    Object.values(estimates).reduce((acc, value) => acc + value.raw, 0),
    expected,
  );
  return estimates;
}

const report = {};
for (const variant of ["baseline", "hls-light", "compiler-subpath"]) {
  const isCompiler = variant === "compiler-subpath";
  const consumer = join(run, `consumer-${variant}`);
  const packed = join(consumer, "node_modules", pkg);
  const releaseRoot = join(packed, "dist");
  const names = readdirSync(releaseRoot, { recursive: true });
  const scripts = names.filter((file) => /\.[cm]?js$/.test(file));
  const css = names.filter((file) => /\.css$/.test(file));
  const release = {
    js: measureFiles(releaseRoot, scripts),
    css: measureFiles(releaseRoot, css),
    attributionEstimate: attribution(releaseRoot, scripts),
  };
  release.totalJs = sumSizes(Object.values(release.js));
  const exports = JSON.parse(readFileSync(join(packed, "package.json"), "utf8")).exports;
  const target = (key) => (typeof exports[key] === "string" ? exports[key] : exports[key].import);
  assert.ok(existsSync(join(packed, exports["."].types)));
  const publicEntries = [".", "./styles.css", "./custom-only.css"];
  if (isCompiler) {
    publicEntries.push(compilerSubpath);
    assert.ok(existsSync(join(packed, exports[compilerSubpath].types)));
  }
  for (const key of publicEntries) {
    const path = target(key);
    const url = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "console.log(import.meta.resolve(process.argv[1]))",
        `${pkg}${key.slice(1)}`,
      ],
      { cwd: consumer, encoding: "utf8" },
    ).trim();
    assert.equal(url, pathToFileURL(realpathSync(join(packed, path))).href);
  }
  const customPath = join(packed, target("./custom-only.css"));
  const customCss = readFileSync(customPath, "utf8");
  release.customCssRelativeAssets = [
    ...customCss.matchAll(/url\(["']?(\.\.?\/[^"')]+)["']?\)/g),
  ].map(([, url]) => {
    const buildAsset = resolve(run, isCompiler ? "baseline" : variant, "dist", url);
    return {
      url,
      existsFromPackedCss: existsSync(resolve(dirname(customPath), url)),
      referencedBuildAsset: existsSync(buildAsset) ? sizes(readFileSync(buildAsset)) : null,
    };
  });
  report[variant] = { release, fixtures: {} };
  const entries = isCompiler
    ? { "compiler-subpath": compilerEntry(`import compileCutList from "${pkg}/compile-cut-list";`) }
    : fixtures;
  for (const [name, entry] of Object.entries(entries)) {
    const root = join(consumer, name);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, "index.html"),
      '<!doctype html><html><body><div id="app"></div><script type="module" src="/main.js"></script></body></html>\n',
    );
    writeFileSync(join(root, "main.js"), entry);
    const outDir = join(root, "dist");
    const result = await build({
      configFile: false,
      root,
      mode: "production",
      logLevel: "warn",
      cacheDir: join(root, ".vite"),
      // Hidden maps are an audit aid only. Default Vite production app minifier.
      build: { sourcemap: "hidden" },
    });
    const output = (Array.isArray(result) ? result : [result]).flatMap((out) => out.output);
    const chunks = output.filter((x) => x.type === "chunk");
    const moduleIds = chunks.flatMap((chunk) => Object.keys(chunk.modules));
    const imported = isCompiler
      ? compilerSubpath
      : name === "custom-css-import"
        ? "./custom-only.css"
        : ".";
    assert.ok(
      moduleIds.includes(join(packed, target(imported))),
      `${name} must import the packed ${imported} export`,
    );
    if (isCompiler) assert.ok(!moduleIds.includes(join(packed, target("."))));
    const entryChunks = chunks.filter((x) => x.isEntry);
    const initial = new Set(entryChunks.map((x) => x.fileName));
    for (const key of initial) {
      for (const dep of chunks.find((x) => x.fileName === key).imports) {
        // Only follow emitted chunks, not host dependencies. No JS externals
        // are configured in these fixture builds.
        if (chunks.some((x) => x.fileName === dep)) initial.add(dep);
      }
    }
    const js = measureFiles(
      outDir,
      chunks.map((x) => x.fileName),
    );
    const css = measureFiles(
      outDir,
      output.filter((x) => x.fileName.endsWith(".css")).map((x) => x.fileName),
    );
    assert.equal(Object.keys(css).length > 0, !isCompiler && name !== "compile-cut-list");
    const otherFiles = output.filter(
      (x) => x.type === "asset" && !/\.(?:map|css|html)$/.test(x.fileName),
    );
    const resultSizes = {
      js,
      initialJs: sumSizes([...initial].map((key) => js[key])),
      deferredJs: sumSizes(
        Object.keys(js)
          .filter((key) => !initial.has(key))
          .map((key) => js[key]),
      ),
      totalJs: sumSizes(Object.values(js)),
      css,
      assets: measureFiles(
        outDir,
        otherFiles.map((x) => x.fileName),
      ),
      attributionEstimate: attribution(
        outDir,
        chunks.map((x) => x.fileName),
      ),
      packageModules: moduleIds
        .filter((id) => id.includes(packed) || id.startsWith(run))
        .map((id) => relative(run, id)),
    };
    report[variant].fixtures[name] = resultSizes;
  }
  console.log(variant, release.totalJs, release.css);
  for (const [name, fixture] of Object.entries(report[variant].fixtures)) {
    console.log(
      `  ${name} JS initial/deferred/total`,
      fixture.initialJs,
      fixture.deferredJs,
      fixture.totalJs,
    );
  }
}

const packedPath = (variant) => join(run, `consumer-${variant}`, "node_modules", pkg);
const baselinePath = packedPath("baseline");
const candidatePath = packedPath("compiler-subpath");
const existingManifest = JSON.parse(readFileSync(join(baselinePath, "package.json"), "utf8"));
const candidateManifest = JSON.parse(readFileSync(join(candidatePath, "package.json"), "utf8"));
delete candidateManifest.exports[compilerSubpath];
assert.deepEqual(candidateManifest, existingManifest, "Only the temporary export should change");
for (const file of readdirSync(join(baselinePath, "dist"), {
  recursive: true,
  withFileTypes: true,
})) {
  if (!file.isFile()) continue;
  const original = join(file.parentPath, file.name);
  const copy = join(candidatePath, relative(baselinePath, original));
  assert.ok(
    readFileSync(original).equals(readFileSync(copy)),
    `Unchanged release file: ${original}`,
  );
}

const baselineCompiler = report.baseline.fixtures["compile-cut-list"];
const subpathCompiler = report["compiler-subpath"].fixtures["compiler-subpath"];
report.comparisons = {
  compilerSubpath: {
    releaseJsAdded: difference(
      report["compiler-subpath"].release.totalJs,
      report.baseline.release.totalJs,
    ),
    consumerJsSaved: {
      initial: difference(baselineCompiler.initialJs, subpathCompiler.initialJs),
      deferred: difference(baselineCompiler.deferredJs, subpathCompiler.deferredJs),
      total: difference(baselineCompiler.totalJs, subpathCompiler.totalJs),
    },
  },
};
console.log("Compiler subpath comparison:", report.comparisons.compilerSubpath);
writeFileSync(join(run, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
