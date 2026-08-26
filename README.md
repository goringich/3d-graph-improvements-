# 3D Intelligence Graph

This repository is the LOCAL AI OS fork of the Obsidian 3D Graph plugin. The original 3D graph renderer remains the rendering foundation, while this fork adds a typed, read-only intelligence layer for exploring Obsidian knowledge, architecture, projects, runtime state, AI components, dependencies, semantic relations and temporal changes in one 3D surface.

Current source release: **1.2.1**.

## What is added in this fork

- Unified Intelligence Graph projection with native Obsidian fallback.
- Lenses for `all`, `knowledge`, `architecture`, `projects`, `runtime`, `ai`, `security`, `dependencies`, `live`, `semantic` and `changes`.
- Spotlight commands such as `impact of X`, `dependencies of X`, `what depends on X` and `path A -> B`.
- Directed incoming/outgoing/both exploration and shortest paths.
- Isolated focus subgraphs for impact/path work instead of animating the entire universe.
- Typed edge rendering with confidence-aware visual weight and directional arrows.
- Large-scene level-of-detail suppression while focused paths remain visible.
- Graph Health diagnostics for fragmentation, orphan debt, source coverage, cross-source bridges, exact identity coverage, unknown relation semantics and unavailable producers.
- Fail-closed impact semantics: unknown or non-operational relations never silently become dependencies.

The plugin is a **read-only explorer**. It does not become architecture authority, runtime authority, RAG authority, project authority or note-mutation authority.

## Source and branch contract

`main` is the canonical source line for the LOCAL AI OS fork.

The historical working branch `feature/safe-display-force-controls` currently points to the same release line and remains only for compatibility with the repository's existing default-branch setting. New work should branch from and target `main`.

The unrelated pre-fork upstream `main` history was preserved losslessly at:

`archive/upstream-main-pre-ai-os-20260826`

## Installation

This fork is not represented by the upstream Obsidian community-plugin listing. For exact LOCAL AI OS behavior, install a build from this repository into the vault plugin directory:

`.obsidian/plugins/3d-graph/`

The installed directory must contain at least:

- `manifest.json`
- `main.js`
- `styles.css`

For live acceptance, verify that `manifest.json` reports version `1.2.1` and run the LOCAL AI OS graph refresh/acceptance pipeline against the real vault.

## Development

Requirements:

- Node.js 22 for CI parity.
- npm lockfile installation with `npm ci`.

Validation:

```bash
npm ci
npm test
npm run build
```

CI runs the deterministic tests and production build on pull requests. Push validation is maintained for both the canonical `main` line and the historical compatibility branch until the GitHub default-branch setting is migrated to `main`.

## Upstream origin

The original Obsidian 3D Graph project and its authors remain credited in the plugin manifest and source history. This repository contains additional LOCAL AI OS extensions maintained by `goringich`.