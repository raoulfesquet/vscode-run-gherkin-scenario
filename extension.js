const vscode = require('vscode');

const SCENARIO_RE = /^\s*Scenario(?:\s+Outline)?:/;
const TAG_RE = /@(\w+)/g;
const SINGLE_TAG_RE = /@(\w+)/;

// ── Feature-file header parsing ────────────────────────────────

function parseHeaderTagLines(document) {
  const tagLines = [];
  for (let i = 0; i < document.lineCount; i++) {
    const text = document.lineAt(i).text.trim();
    if (/^Feature:/.test(text)) break;
    if (text.startsWith('#') || text === '') continue;
    const tags = [...text.matchAll(TAG_RE)].map(m => `@${m[1]}`);
    if (tags.length > 0) tagLines.push({ tags });
  }
  return tagLines;
}

// ── Scenario goal-tag extraction ───────────────────────────────

function findGoalTagAt(document, scenarioLine) {
  if (scenarioLine === 0) return null;
  const match = document.lineAt(scenarioLine - 1).text.match(SINGLE_TAG_RE);
  return match ? `@${match[1]}` : null;
}

function findGoalTag(document, lineNumber) {
  let scenarioLine = null;

  for (let i = lineNumber; i < Math.min(document.lineCount, lineNumber + 3); i++) {
    if (SCENARIO_RE.test(document.lineAt(i).text)) { scenarioLine = i; break; }
  }
  if (scenarioLine === null) {
    for (let i = lineNumber; i >= 0; i--) {
      if (SCENARIO_RE.test(document.lineAt(i).text)) { scenarioLine = i; break; }
    }
  }
  if (scenarioLine === null) return null;

  return findGoalTagAt(document, scenarioLine);
}

// ── Persistent tag choices ─────────────────────────────────────

function choicesKey(filePath) {
  return `tagChoices:${filePath}`;
}

async function resolveHeaderTags(document, state) {
  const tagLines = parseHeaderTagLines(document);
  const key = choicesKey(document.uri.fsPath);
  const stored = state.get(key, {});
  const resolved = [];
  let dirty = false;

  for (const { tags } of tagLines) {
    if (tags.length === 1) {
      resolved.push(tags[0]);
      continue;
    }

    const setKey = tags.map(t => t.slice(1)).sort().join(',');

    if (stored[setKey] && tags.includes(stored[setKey])) {
      resolved.push(stored[setKey]);
    } else {
      const picked = await vscode.window.showQuickPick(tags, {
        placeHolder: `Choose one: ${tags.join('  ')}`,
        title: 'Multiple tags on the same line',
      });
      if (!picked) return null;
      stored[setKey] = picked;
      dirty = true;
      resolved.push(picked);
    }
  }

  if (dirty) await state.update(key, stored);
  return resolved;
}

// ── Run ────────────────────────────────────────────────────────

async function runScenario(context, visual, lineOverride) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const line = typeof lineOverride === 'number' ? lineOverride : editor.selection.active.line;
  const goalTag = findGoalTag(editor.document, line);
  if (!goalTag) {
    vscode.window.showWarningMessage('No scenario goal tag found at cursor position');
    return;
  }

  const headerTags = await resolveHeaderTags(editor.document, context.workspaceState);
  if (!headerTags) return;

  const cfg = vscode.workspace.getConfiguration('gherkinRunner');
  const strip = cfg.get('stripTagPrefix', false);
  const runCmd = cfg.get('runCommand', 'npx cucumber-js');
  const defaultFlags = cfg.get('defaultFlags', []);

  const allTags = [...headerTags, goalTag].map(t => strip ? t.replace(/^@/, '') : t);
  const flags = [...defaultFlags];
  if (visual) flags.push('--visual');

  const parts = [runCmd, ...allTags];
  if (flags.length > 0) parts.push(...flags);
  const cmd = parts.join(' ');

  const termName = `Scenario: ${goalTag}`;
  let terminal = vscode.window.terminals.find(t => t.name === termName);
  if (!terminal) terminal = vscode.window.createTerminal({ name: termName });
  terminal.show();
  terminal.sendText(cmd);
}

// ── CodeLens ───────────────────────────────────────────────────

class ScenarioCodeLensProvider {
  constructor() {
    this._onDidChange = new vscode.EventEmitter();
    this.onDidChangeCodeLenses = this._onDidChange.event;

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gherkinRunner.showCodeLens') ||
          e.affectsConfiguration('gherkinRunner.showVisualCodeLens')) {
        this._onDidChange.fire();
      }
    });
  }

  provideCodeLenses(document) {
    const cfg = vscode.workspace.getConfiguration('gherkinRunner');
    if (!cfg.get('showCodeLens', true)) return [];

    const showVisual = cfg.get('showVisualCodeLens', false);
    const lenses = [];

    for (let i = 0; i < document.lineCount; i++) {
      if (!SCENARIO_RE.test(document.lineAt(i).text)) continue;

      const goalTag = findGoalTagAt(document, i);
      if (!goalTag) continue;

      const range = new vscode.Range(i, 0, i, 0);

      lenses.push(new vscode.CodeLens(range, {
        title: `\u25B6 Run ${goalTag}`,
        command: 'gherkin.runScenarioAt',
        arguments: [i, false],
      }));

      if (showVisual) {
        lenses.push(new vscode.CodeLens(range, {
          title: '\u25B6 Run (visual)',
          command: 'gherkin.runScenarioAt',
          arguments: [i, true],
        }));
      }
    }

    return lenses;
  }
}

// ── Configure flags ────────────────────────────────────────────

async function configureFlags() {
  const cfg = vscode.workspace.getConfiguration('gherkinRunner');
  const current = cfg.get('defaultFlags', []);
  const available = cfg.get('availableFlags', []);

  if (available.length > 0) {
    const items = available.map(f => ({
      label: f.flag,
      detail: f.label,
      picked: current.includes(f.flag),
    }));

    const picked = await vscode.window.showQuickPick(items, {
      canPickMany: true,
      placeHolder: 'Select default flags for scenario runs',
      title: 'Gherkin Runner \u2014 Default Flags',
    });
    if (!picked) return;

    const newFlags = picked.map(p => p.label);
    await cfg.update('defaultFlags', newFlags, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Default flags: ${newFlags.join(' ') || '(none)'}`);
  } else {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter default flags separated by spaces (e.g. -v --format progress)',
      value: current.join(' '),
      title: 'Gherkin Runner \u2014 Default Flags',
    });
    if (input === undefined) return;

    const newFlags = input.trim() ? input.trim().split(/\s+/) : [];
    await cfg.update('defaultFlags', newFlags, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`Default flags: ${newFlags.join(' ') || '(none)'}`);
  }
}

// ── Reset tag choices ──────────────────────────────────────────

async function resetTagChoices(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('Open a .feature file first');
    return;
  }
  const key = choicesKey(editor.document.uri.fsPath);
  await context.workspaceState.update(key, undefined);
  vscode.window.showInformationMessage('Tag choices reset \u2014 they will be asked again on next run.');
}

// ── Lifecycle ──────────────────────────────────────────────────

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('gherkin.runScenario', () => runScenario(context, false)),
    vscode.commands.registerCommand('gherkin.runScenarioVisual', () => runScenario(context, true)),
    vscode.commands.registerCommand('gherkin.runScenarioAt', (line, visual) => runScenario(context, visual, line)),
    vscode.commands.registerCommand('gherkin.configureFlags', () => configureFlags()),
    vscode.commands.registerCommand('gherkin.resetTagChoices', () => resetTagChoices(context)),
    vscode.languages.registerCodeLensProvider(
      { pattern: '**/*.feature' },
      new ScenarioCodeLensProvider(),
    ),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
