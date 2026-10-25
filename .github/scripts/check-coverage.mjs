import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const normalize = (name) => name.replaceAll("\\", "/").replace(/^\.\//, "");
const production = (name) =>
  name.startsWith("contracts/") &&
  name.endsWith(".sol") &&
  !name.endsWith(".t.sol") &&
  !/(^|\/)(mocks|helpers|test|tests)\//.test(name);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(location) : [location];
  });
}

// Compiler ASTs distinguish executable code from comments and declarations.
function hasExecutableCode(node) {
  if (!node || typeof node !== "object") return false;
  if (
    ["FunctionDefinition", "ModifierDefinition"].includes(node.nodeType) &&
    node.body?.statements?.length > 0
  )
    return true;
  if (
    node.nodeType === "VariableDeclaration" &&
    node.stateVariable &&
    !node.constant &&
    node.value
  )
    return true;
  return Object.values(node).some((value) =>
    Array.isArray(value)
      ? value.some(hasExecutableCode)
      : hasExecutableCode(value),
  );
}

export function parseLcov(text) {
  const records = new Map();
  let record;
  const integer = (value) =>
    /^\d+$/.test(value) && Number.isSafeInteger(+value);
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("TN:")) continue;
    if (line.startsWith("SF:")) {
      if (record) throw new Error("LCOV record missing end_of_record");
      const name = normalize(line.slice(3));
      if (!name || records.has(name))
        throw new Error("Empty or duplicate LCOV source");
      record = { name, lines: new Map() };
    } else if (line === "end_of_record") {
      if (!record) throw new Error("Unexpected LCOV end_of_record");
      if (
        record.found !== record.lines.size ||
        record.hit !==
          [...record.lines.values()].filter((count) => count > 0).length
      )
        throw new Error(`Invalid LCOV totals for ${record.name}`);
      records.set(record.name, record);
      record = undefined;
    } else {
      if (!record) throw new Error("LCOV data outside a source record");
      if (line.startsWith("DA:")) {
        const [number, count] = line.slice(3).split(",");
        if (
          !integer(number) ||
          +number === 0 ||
          !integer(count) ||
          record.lines.has(+number)
        )
          throw new Error(`Invalid LCOV line in ${record.name}`);
        record.lines.set(+number, +count);
      } else if (line.startsWith("LF:") || line.startsWith("LH:")) {
        const key = line.startsWith("LF:") ? "found" : "hit";
        if (!integer(line.slice(3)) || record[key] !== undefined)
          throw new Error(`Invalid LCOV summary in ${record.name}`);
        record[key] = +line.slice(3);
      } else if (!/^(FN|FNDA|FNF|FNH|BRDA|BRF|BRH):/.test(line)) {
        throw new Error(`Unknown LCOV field: ${line}`);
      }
    }
  }
  if (record || records.size === 0)
    throw new Error("LCOV report is empty or incomplete");
  return records;
}

export function analyzeCoverage(root = process.cwd()) {
  const sources = walk(path.join(root, "contracts"))
    .map((file) => normalize(path.relative(root, file)))
    .filter(production)
    .sort();
  if (sources.length === 0) throw new Error("No production Solidity sources");
  const executable = new Map();
  const buildDirectory = path.join(root, "artifacts/build-info");
  for (const file of readdirSync(buildDirectory)) {
    if (!file.endsWith(".json") || file.endsWith(".output.json")) continue;
    const build = JSON.parse(readFileSync(path.join(buildDirectory, file)));
    const outputFile = path.join(
      buildDirectory,
      file.replace(/\.json$/, ".output.json"),
    );
    const { output } = JSON.parse(readFileSync(outputFile));
    for (const source of sources) {
      const key = build.userSourceNameMap?.[source];
      if (!key) continue;
      // Ignore stale and instrumented builds. Rebuild normally after coverage
      // to provide an uninstrumented AST for each current production source.
      if (
        build.input?.sources?.[key]?.content !==
        readFileSync(path.join(root, source), "utf8")
      )
        continue;
      const ast = output?.sources?.[key]?.ast;
      if (!ast) throw new Error(`Missing compiler AST for ${source}`);
      executable.set(source, hasExecutableCode(ast));
    }
  }
  const records = parseLcov(
    readFileSync(path.join(root, "coverage/lcov.info"), "utf8"),
  );
  const rows = sources.map((source) => {
    if (!executable.has(source))
      throw new Error(
        `No current compiler AST for ${source}; run hardhat build`,
      );
    const record = records.get(source);
    if (executable.get(source) && (!record || record.found === 0))
      throw new Error(`Missing executable source in LCOV: ${source}`);
    return {
      source,
      found: record?.found ?? 0,
      hit: record?.hit ?? 0,
      uncovered: record
        ? [...record.lines]
            .filter(([, count]) => count === 0)
            .map(([line]) => line)
        : [],
    };
  });
  const found = rows.reduce((total, row) => total + row.found, 0);
  const hit = rows.reduce((total, row) => total + row.hit, 0);
  if (found === 0) throw new Error("No executable production lines in LCOV");
  return {
    rows,
    found,
    hit,
    passed: rows.every((row) => row.hit === row.found),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = analyzeCoverage();
    const summary = `${result.hit}/${result.found} lines (${((100 * result.hit) / result.found).toFixed(2)}%)`;
    const markdown = [
      "## Solidity line coverage",
      "",
      `Required: 100% per production source. Result: ${summary}.`,
      "",
      ...result.rows.map(
        (row) =>
          `- ${row.source.replaceAll("`", "")} — ${row.found ? `${row.hit}/${row.found}` : "N/A (no executable lines)"}${row.uncovered.length ? `; uncovered lines: ${row.uncovered.join(", ")}` : ""}`,
      ),
      "",
      "Branch coverage is not provided by Hardhat.",
      "",
    ].join("\n");
    console.log(markdown);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `coverage=${summary}\n`);
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    console.error(`Coverage check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
