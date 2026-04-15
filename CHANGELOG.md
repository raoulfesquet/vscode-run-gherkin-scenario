# Changelog

All notable changes to **Run Gherkin Scenario** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.3.0] - 2026-04-15

### Added

- Scenario-level tag parsing: tags above `Scenario:` lines (e.g. under `#context`) are now collected alongside header tags
- Per-scenario tag choices: first run establishes file-level defaults, subsequent scenarios inherit automatically
- Contextual reset: "↺ Reset Tag Choices" in right-click menu resets only the targeted scenario
- Inline `↺ Reset tags` CodeLens button next to the Run button on each scenario

### Changed

- Custom flags input in setup wizard is now shown only when "✏ Custom flags…" is selected in the picker

### Fixed

- Multi-tag lines at scenario level (e.g. `@fr @com @sn` under `#context`) were previously ignored

## [1.2.1] - 2026-04-10

### Added

- First-run setup wizard (3 steps): run command, strip @ prefix, default flags
- Common flags catalog with descriptions in the flags picker
- Custom flags input after the catalog picker
- All settings scoped to resource for multi-root workspace support

### Fixed

- Folder settings write error in multi-root workspaces

## [1.0.1] - 2026-04-10

### Changed

- Updated extension icon

## [1.0.0] - 2026-04-09

### Added

- Right-click context menu: **Run Scenario** on `.feature` files
- CodeLens inline `▶ Run @tag` button above each `Scenario:` / `Scenario Outline:` line
- Automatic parsing of feature-file header tags (brand, environment, platform, etc.)
- Multi-tag quickpick when a header line contains several tags (e.g. `@android @ios`)
- Persistent tag choices per file (survives editor restarts)
- Configurable run command (`gherkinRunner.runCommand`)
- Configurable default CLI flags (`gherkinRunner.defaultFlags`)
- Project-level available flags picker (`gherkinRunner.availableFlags`)
- Option to strip `@` prefix from tags (`gherkinRunner.stripTagPrefix`)
- Toggle CodeLens visibility (`gherkinRunner.showCodeLens`)
- Optional visual run CodeLens (`gherkinRunner.showVisualCodeLens`)
- Command: **Gherkin: Configure Run Flags** (quickpick or freeform input)
- Command: **Gherkin: Reset Tag Choices**
