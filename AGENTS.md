# Hardhat + viem and Vue monorepo

## Project layout

```
blockchain/contracts/        Solidity source files (*.sol) and unit tests (*.t.sol)
blockchain/test/             TypeScript integration tests and Solidity unit tests (*.sol)
blockchain/ignition/         Hardhat Ignition deployment modules
blockchain/scripts/          Standalone scripts run with `hardhat run`
blockchain/hardhat.config.ts
web/                         Vue + Vite frontend
```

## Working in this project

Install dependencies from the repository root with `npm ci`. Use root npm scripts
to coordinate workspaces; each workspace owns its build, typecheck, and lint.
Root scoped commands follow `action:workspace`, such as `build:blockchain` and
`build:web`. Lint commands check only; use `lint:fix:web` to apply web fixes.

When writing or modifying tests, configuring `hardhat.config.ts`, or interacting with the network from TypeScript, invoke the **`hardhat`** skill. It covers Solidity and TypeScript testing, how to choose between them, `forge-std` cheatcodes, the `network.create()` API, `networkHelpers`, and the compile-then-typecheck workflow. The skill itself points to the matching `hardhat-toolbox-*` skill for toolbox-specific guidance (clients, contract interaction, assertions).

## Docs

- Hardhat 3 — https://hardhat.org/llms.txt
- viem — https://viem.sh/llms.txt
