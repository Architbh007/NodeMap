/** User-facing name for the optional AI explanation feature (tune → Tunner). */
export const TUNNER = {
  name: 'Tunner',
  tagline: 'Tune into your codebase with contextual explanations on demand.',
  ask: 'Ask Tunner',
  thinking: 'Tunner is thinking…',
  explainBy: 'Explained by Tunner',
  briefAction: 'Generate repo brief',
  panelTitle: 'Tunner',
  architectureBrief: 'Architecture brief',
  settingsNote: 'Optional. Powers Tunner only. NodeMap analysis works without it.',
  notConfigured: 'Tunner is not configured.',
  configureHint: 'Choose OpenAI or Gemini in Settings and add an API key to enable Tunner.',
  chooseFile: 'Choose a file or generate a repo brief',
} as const;
