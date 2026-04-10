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

// ── Common flags catalog ────────────────────────────────────────

const COMMON_FLAGS = [
  { flag: '-v', label: 'Verbose output' },
  { flag: '--verbose', label: 'Verbose output (long form)' },
  { flag: '-l', label: 'Local testing mode' },
  { flag: '--local-testing', label: 'Local testing mode (long form)' },
  { flag: '--visual', label: 'Run with browser visible' },
  { flag: '--dry-run', label: 'Validate without executing' },
  { flag: '--parallel', label: 'Run scenarios in parallel' },
  { flag: '--retry', label: 'Retry failed scenarios' },
  { flag: '--format progress', label: 'Progress format output' },
  { flag: '--format json', label: 'JSON format output' },
];

// ── First-run setup ─────────────────────────────────────────────

function needsSetup(cfg) {
  const keys = ['runCommand', 'stripTagPrefix', 'defaultFlags'];
  return keys.every(k => {
    const i = cfg.inspect(k);
    return i.workspaceValue === undefined && i.workspaceFolderValue === undefined;
  });
}

async function firstRunSetup(resource) {
  const cfg = vscode.workspace.getConfiguration('gherkinRunner', resource);
  if (!needsSetup(cfg)) return true;

  const inspected = cfg.inspect('runCommand');
  const cmd = await vscode.window.showInputBox({
    prompt: 'Step 1/3 — Enter the command used to run scenarios in this project',
    placeHolder: 'e.g. yarn cjs, npx cucumber-js, npx codeceptjs run --grep',
    value: inspected.globalValue || inspected.defaultValue || 'npx cucumber-js',
    title: 'Gherkin Runner — First Run Setup',
    ignoreFocusOut: true,
  });
  if (cmd === undefined) return false;
  await cfg.update('runCommand', cmd.trim() || 'npx cucumber-js', vscode.ConfigurationTarget.WorkspaceFolder);

  const stripChoice = await vscode.window.showQuickPick(
    [
      { label: 'Yes', detail: 'Tags will be passed without @ (e.g. smoke instead of @smoke)', value: true },
      { label: 'No', detail: 'Tags will keep the @ prefix (e.g. @smoke)', value: false },
    ],
    {
      placeHolder: 'Does your CLI expect tags without the @ prefix?',
      title: 'Gherkin Runner — Step 2/3 — Strip @ prefix',
      ignoreFocusOut: true,
    },
  );
  if (!stripChoice) return false;
  await cfg.update('stripTagPrefix', stripChoice.value, vscode.ConfigurationTarget.WorkspaceFolder);

  const flagItems = COMMON_FLAGS.map(f => ({ label: f.flag, detail: f.label, picked: false }));
  const picked = await vscode.window.showQuickPick(flagItems, {
    canPickMany: true,
    placeHolder: 'Select flags to add to every run (or press Enter to skip)',
    title: 'Gherkin Runner — Step 3/3 — Default flags',
    ignoreFocusOut: true,
  });
  const flags = picked ? picked.map(p => p.label) : [];

  const custom = await vscode.window.showInputBox({
    prompt: 'Add custom flags? (space-separated, or leave empty to skip)',
    placeHolder: 'e.g. --timeout 30000 --bail',
    title: 'Gherkin Runner — Step 3/3 — Custom flags',
    ignoreFocusOut: true,
  });
  if (custom && custom.trim()) {
    flags.push(...custom.trim().split(/\s+/));
  }

  await cfg.update('defaultFlags', flags, vscode.ConfigurationTarget.WorkspaceFolder);

  const summary = [`Command: ${cmd.trim() || 'npx cucumber-js'}`, `Strip @: ${stripChoice.value ? 'yes' : 'no'}`];
  if (flags.length) summary.push(`Flags: ${flags.join(' ')}`);
  vscode.window.showInformationMessage(`Setup complete — ${summary.join(' | ')}`);
  return true;
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

  const resource = editor.document.uri;
  const ready = await firstRunSetup(resource);
  if (!ready) return;

  const cfg = vscode.workspace.getConfiguration('gherkinRunner', resource);
  const runCmd = cfg.get('runCommand', 'npx cucumber-js');
  const strip = cfg.get('stripTagPrefix', false);
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
