import { rmSync } from "node:fs";

// Only remove the project's generated report, never a path supplied by a PR.
rmSync(new URL("../../blockchain/coverage/", import.meta.url), {
  recursive: true,
  force: true,
});
