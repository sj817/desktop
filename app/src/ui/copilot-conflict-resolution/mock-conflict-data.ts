/**
 * Mock data for the Copilot conflict resolution POC.
 *
 * Each mock file contains all four versions needed for the comparison tabs:
 * the original conflict, "ours", "theirs", and Copilot's merged suggestion.
 */

/** A single conflicted file with all four content versions. */
export interface IMockConflictFile {
  readonly path: string
  readonly summary: string
  readonly reasoning: string
  readonly versions: {
    readonly conflict: string
    readonly ours: string
    readonly theirs: string
    readonly copilot: string
  }
}

export const mockConflictFiles: ReadonlyArray<IMockConflictFile> = [
  {
    path: 'src/config.json',
    summary: 'Combined security settings with redesign features',
    reasoning:
      'Kept the production database host and SSL from the security branch, ' +
      'while adding the timeout and new dashboard feature from the redesign branch. ' +
      'Used the larger pool size (20) for better production performance.',
    versions: {
      conflict: `{
  "appName": "WidgetManager",
  "version": "2.1.0",
<<<<<<< HEAD
  "database": {
    "host": "db.internal",
    "pool_size": 20,
    "ssl": true
  },
  "features": {
    "dark_mode": true,
    "audit_logging": true
=======
  "database": {
    "host": "localhost",
    "pool_size": 10,
    "timeout": 30000
  },
  "features": {
    "dark_mode": true,
    "new_dashboard": true
>>>>>>> feature/redesign
  }
}`,
      ours: `{
  "appName": "WidgetManager",
  "version": "2.1.0",
  "database": {
    "host": "db.internal",
    "pool_size": 20,
    "ssl": true
  },
  "features": {
    "dark_mode": true,
    "audit_logging": true
  }
}`,
      theirs: `{
  "appName": "WidgetManager",
  "version": "2.1.0",
  "database": {
    "host": "localhost",
    "pool_size": 10,
    "timeout": 30000
  },
  "features": {
    "dark_mode": true,
    "new_dashboard": true
  }
}`,
      copilot: `{
  "appName": "WidgetManager",
  "version": "2.1.0",
  "database": {
    "host": "db.internal",
    "pool_size": 20,
    "ssl": true,
    "timeout": 30000
  },
  "features": {
    "dark_mode": true,
    "audit_logging": true,
    "new_dashboard": true
  }
}`,
    },
  },
  {
    path: 'src/utils.ts',
    summary: 'Added sanitization to new title parameter',
    reasoning:
      'The security branch added XSS sanitization to formatDisplayName, ' +
      'and the redesign branch added a title parameter. Combined both: ' +
      'the function now accepts a title and sanitizes all string inputs.',
    versions: {
      conflict: `<<<<<<< HEAD
/** Format a user's display name (sanitized) */
export function formatDisplayName(first: string, last: string): string {
  const sanitize = (s: string) => s.replace(/[<>&"']/g, '')
  return \`\${sanitize(first)} \${sanitize(last)}\`
}
=======
/** Format a user's display name */
export function formatDisplayName(first: string, last: string, title?: string): string {
  const name = \`\${first} \${last}\`
  return title ? \`\${title} \${name}\` : name
}
>>>>>>> feature/redesign`,
      ours: `/** Format a user's display name (sanitized) */
export function formatDisplayName(first: string, last: string): string {
  const sanitize = (s: string) => s.replace(/[<>&"']/g, '')
  return \`\${sanitize(first)} \${sanitize(last)}\`
}`,
      theirs: `/** Format a user's display name */
export function formatDisplayName(first: string, last: string, title?: string): string {
  const name = \`\${first} \${last}\`
  return title ? \`\${title} \${name}\` : name
}`,
      copilot: `/** Format a user's display name (sanitized) */
export function formatDisplayName(first: string, last: string, title?: string): string {
  const sanitize = (s: string) => s.replace(/[<>&"']/g, '')
  const name = \`\${sanitize(first)} \${sanitize(last)}\`
  return title ? \`\${sanitize(title)} \${name}\` : name
}`,
    },
  },
  {
    path: 'README.md',
    summary: 'Merged documentation with security section',
    reasoning:
      'Kept the yarn/dev setup from the redesign branch (modern tooling), ' +
      'preserved the Security section from the security branch, ' +
      'and combined both Contributing guidelines.',
    versions: {
      conflict: `# WidgetManager

A modern widget management platform.

## Getting Started

<<<<<<< HEAD
\`\`\`bash
npm install
npm run start
\`\`\`

## Security

All inputs are sanitized. Please report vulnerabilities
to security@widgets.io.

## Contributing

Run \`npm test\` before submitting a PR.
=======
\`\`\`bash
yarn install
yarn dev
\`\`\`

## New Dashboard

The redesigned dashboard supports drag-and-drop widgets
and real-time previews.

## Contributing

Run \`yarn test\` and \`yarn lint\` before submitting a PR.
>>>>>>> feature/redesign`,
      ours: `# WidgetManager

A modern widget management platform.

## Getting Started

\`\`\`bash
npm install
npm run start
\`\`\`

## Security

All inputs are sanitized. Please report vulnerabilities
to security@widgets.io.

## Contributing

Run \`npm test\` before submitting a PR.`,
      theirs: `# WidgetManager

A modern widget management platform.

## Getting Started

\`\`\`bash
yarn install
yarn dev
\`\`\`

## New Dashboard

The redesigned dashboard supports drag-and-drop widgets
and real-time previews.

## Contributing

Run \`yarn test\` and \`yarn lint\` before submitting a PR.`,
      copilot: `# WidgetManager

A modern widget management platform.

## Getting Started

\`\`\`bash
yarn install
yarn dev
\`\`\`

## Security

All inputs are sanitized. Please report vulnerabilities
to security@widgets.io.

## New Dashboard

The redesigned dashboard supports drag-and-drop widgets
and real-time previews.

## Contributing

Run \`yarn test\` and \`yarn lint\` before submitting a PR.`,
    },
  },
]
