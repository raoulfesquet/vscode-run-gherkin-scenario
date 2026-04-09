# Changelog

All notable changes to **Run Gherkin Scenario** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
