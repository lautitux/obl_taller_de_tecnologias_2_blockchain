# Hardhat + viem and Vue monorepo

## Project layout

```
blockchain/contracts/        Solidity source files (*.sol)
blockchain/test/             Solidity tests (*.t.sol)
blockchain/test/mocks/       Helper contracts used by the tests (not tests themselves)
blockchain/ignition/         Hardhat Ignition deployment modules
blockchain/hardhat.config.ts
web/                         Vue + Vite frontend
web/src/abis/                Contract ABIs used by the frontend
web/src/components/          Components grouped by feature (layout/, wallet/, agreement/)
web/src/composables/         Composition functions (`useX.ts`)
web/src/config/              Network deployments and wagmi configuration
web/src/services/            Logic without Vue reactivity (event sync, query persistence)
web/src/views/               Route components (`*View.vue`)
```

File naming in `web/src`: components and views in PascalCase, composables as `useX.ts`,
every other TypeScript module in kebab-case.

## Working in this project

Install dependencies from the repository root with `npm ci`. Use root npm scripts
to coordinate workspaces; each workspace owns its build, typecheck, and lint.
Root scoped commands follow `action:workspace`, such as `build:blockchain` and
`build:web`. Lint commands check only; use `lint:fix:web` to apply web fixes.

When writing or modifying tests, configuring `hardhat.config.ts`, or interacting with the network from TypeScript, invoke the **`hardhat`** skill. It covers Solidity and TypeScript testing, how to choose between them, `forge-std` cheatcodes, the `network.create()` API, `networkHelpers`, and the compile-then-typecheck workflow. The skill itself points to the matching `hardhat-toolbox-*` skill for toolbox-specific guidance (clients, contract interaction, assertions).

## Docs

- Hardhat 3 — https://hardhat.org/llms.txt
- viem — https://viem.sh/llms.txt
