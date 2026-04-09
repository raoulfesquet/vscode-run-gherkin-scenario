# Run Gherkin Scenario

Run any Gherkin scenario straight from VS Code or Cursor — right-click, click the inline button, or use a keyboard shortcut. The extension reads the feature-file header tags, asks you to choose when a line has several values, remembers your picks, and builds the full CLI command for you.

## Features

- **Right-click context menu** — "Run Scenario" appears when you right-click inside a `.feature` file
- **CodeLens inline buttons** — a clickable `▶ Run @tag` appears above every `Scenario:` line
- **Automatic tag parsing** — reads all header tags (brand, environment, platform, etc.) from the feature file
- **Multi-tag quickpick** — when a line has multiple tags (e.g. `@android @ios`), prompts you to choose one
- **Persistent choices** — your picks are saved per file and reused on subsequent runs
- **Configurable command** — works with any Gherkin CLI (Cucumber-JS, CodeceptJS, custom runners)
- **Configurable flags** — set default CLI flags per project

## Usage

### Right-click

Place your cursor anywhere inside a scenario and right-click. Select **"Run Scenario"** from the context menu.

### CodeLens

Click the `▶ Run @goalTag` button that appears above each `Scenario:` line.

### Command Palette

`Cmd+Shift+P` (or `Ctrl+Shift+P`) and search for:

| Command | Description |
|---|---|
| **Run Scenario** | Run the scenario at the cursor position |
| **Run Scenario (visual)** | Run with `--visual` flag appended |
| **Gherkin: Configure Run Flags** | Pick or type default CLI flags |
| **Gherkin: Reset Tag Choices** | Clear saved multi-tag choices for the current file |

### Keyboard shortcut (optional)

Add this to your `keybindings.json`:

```json
{
  "key": "cmd+shift+t",
  "command": "workbench.action.tasks.runTask",
  "args": "Run Scenario",
  "when": "resourceExtname == .feature"
}
```

## How it works

Given a feature file like this:

```gherkin
@acme
@staging
@chrome @firefox
@en
@smoke
@high
@checkout
@wip
Feature: Checkout

  @checkoutGuestDisplay
  Scenario: Displaying the guest checkout form
    Given a user on the product page
    ...
```

When you run the scenario:

1. The extension collects all header tags: `@acme`, `@staging`, `@chrome @firefox`, `@en`, `@smoke`, `@high`, `@checkout`, `@wip`
2. For `@chrome @firefox` it shows a quickpick — your choice is saved for next time
3. It extracts the goal tag `@checkoutGuestDisplay` from the line above `Scenario:`
4. It builds and runs: `npx cucumber-js @acme @staging @chrome @en @smoke @high @checkout @wip @checkoutGuestDisplay`

## Configuration

All settings live under `gherkinRunner.*` and can be set per-workspace in `.vscode/settings.json`.

| Setting | Type | Default | Description |
|---|---|---|---|
| `gherkinRunner.runCommand` | `string` | `"npx cucumber-js"` | Base command to run scenarios |
| `gherkinRunner.stripTagPrefix` | `boolean` | `false` | Strip `@` from tags before passing to the CLI |
| `gherkinRunner.defaultFlags` | `string[]` | `[]` | Flags appended to every run |
| `gherkinRunner.availableFlags` | `object[]` | `[]` | Flags shown in the "Configure Run Flags" picker (see below) |
| `gherkinRunner.showCodeLens` | `boolean` | `true` | Show inline Run buttons above each Scenario |
| `gherkinRunner.showVisualCodeLens` | `boolean` | `false` | Show an additional Run (visual) CodeLens button |

### Example: CodeceptJS project

```json
{
  "gherkinRunner.runCommand": "yarn cjs",
  "gherkinRunner.stripTagPrefix": true,
  "gherkinRunner.defaultFlags": ["-v"],
  "gherkinRunner.availableFlags": [
    { "flag": "-v", "label": "Verbose output" },
    { "flag": "-d", "label": "Debug mode" },
    { "flag": "-s", "label": "Interactive step-by-step debug" },
    { "flag": "-D", "label": "Show browser (Playwright)" },
    { "flag": "-l", "label": "Local device testing" },
    { "flag": "--visual", "label": "Visual regression (Pixelmatch)" },
    { "flag": "-e", "label": "Export results to test referential" }
  ]
}
```

### Example: Cucumber-JS project

```json
{
  "gherkinRunner.runCommand": "npx cucumber-js",
  "gherkinRunner.defaultFlags": ["--format", "progress"]
}
```

### Example: Custom npm script

```json
{
  "gherkinRunner.runCommand": "npm test --",
  "gherkinRunner.defaultFlags": ["--bail"]
}
```

## Installation

### From the Marketplace

Search for **"Run Gherkin Scenario"** in the Extensions view (`Cmd+Shift+X`).

### From VSIX

Download the `.vsix` file from the [GitHub Releases](https://github.com/raoulfesquet/vscode-run-gherkin-scenario/releases) page, then:

```bash
code --install-extension run-gherkin-scenario-1.0.0.vsix
```

For Cursor:

```bash
/Applications/Cursor.app/Contents/Resources/app/bin/cursor --install-extension run-gherkin-scenario-1.0.0.vsix
```

## License

[MIT](LICENSE)
