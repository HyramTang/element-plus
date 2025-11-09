# Repository Guidelines

## Project Structure & Module Organization

Element Plus is a pnpm workspace. Shipping packages live under `packages/*`: components in `packages/components`, styles in `packages/theme-chalk`, shared code in `packages/utils`, and directives/hooks/locale modules alongside them. Documentation is in `docs` (VitePress) and the developer playground in `play`. Build helpers reside in `internal/*` and custom scripts in `scripts/`. Tests sit next to their subjects inside `packages/**/__tests__`, with SSR fixtures under `ssr-testing/`. Keep new assets scoped to their component folders to avoid leaking into other bundles.

## Build, Test, and Development Commands

- `pnpm install` – install workspace deps (Node ≥ 20, pnpm 10+).
- `pnpm dev` – run the playground for hands-on component development.
- `pnpm docs:dev` / `pnpm docs:build` – iterate on and statically render the VitePress docs.
- `pnpm build` – produce the distributable packages via `internal/build`.
- `pnpm build:theme` – compile Chalk CSS tokens/themes.
- `pnpm test`, `pnpm test:ssr`, `pnpm test:coverage` – Vitest suites (DOM + SSR) with optional coverage.
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm typecheck:web` – ensure ESLint, Prettier, and Vue/TS configs pass before pushing.

## Coding Style & Naming Conventions

Follow the repo’s ESLint + Prettier combo (2-space indent, single quotes, dangling commas where valid). Use TypeScript everywhere; Vue SFCs should default to `<script setup lang="ts">`. Component, directive, and composable folders use kebab-case (e.g., `packages/components/time-select`). Exported symbols stay in PascalCase, but emitted events and CSS variables remain kebab-case. Keep SCSS variables/token maps in `packages/theme-chalk/src/variables.scss`, and mirror prop/type definitions in `index.ts` plus `types.ts` for public typing.

## Testing Guidelines

Vitest with happy-dom drives unit tests; place files as `packages/<scope>/__tests__/<feature>.test.ts`. Match `describe` labels to the package path (e.g., `describe('components/button')`). Prefer explicit DOM assertions over snapshots unless validating large templates, and add SSR counterparts under `ssr-testing` when the component manipulates `window`/`document`. Run `pnpm test:coverage` for contributions touching core behavior; target the existing coverage baseline before submitting.

## Commit & Pull Request Guidelines

Commitlint enforces Conventional Commits—use `pnpm cz` to generate messages such as `feat(cascader): support async nodes`. Keep changes scoped per commit and include BREAKING CHANGE notes when altering APIs. Pull requests must include a summary of the problem, linked issue numbers, reproduction steps (or a `play/` demo), screenshots/gifs when UI changes are visible, and confirmation that `pnpm lint && pnpm test` were run. Update docs/examples alongside feature or breaking modifications to keep `docs/` and `play/` aligned.
