/** @type {import("syncpack").RcFile} */
export default {
  dependencyTypes: [
    'dev',
    'prod',
    'peer',
    'resolutions',
    'overrides',
    'pnpmOverrides',
    // 'local',
  ],
  semverGroups: [
    // design-system should always be used with an exact version
    {
      range: '',
      dependencies: ['@uzh-bf/design-system'],
      packages: ['**'],
    },
    {
      range: '',
      dependencyTypes: [
        'prod',
        'resolutions',
        'overrides',
        'pnpmOverrides',
        // 'local',
      ],
      dependencies: ['**'],
      packages: ['**'],
    },
    {
      range: '~',
      dependencyTypes: ['dev'],
      dependencies: ['!@types/**'],
      packages: ['**'],
    },
    {
      range: '^',
      dependencyTypes: ['dev'],
      dependencies: ['@types/**'],
      packages: ['**'],
    },
    {
      range: '^',
      dependencyTypes: ['peer'],
      dependencies: ['**'],
      packages: ['**'],
    },
  ],
  versionGroups: [
    {
      // FIXME: update when consistent versions are possible (e.g., do other remark updates in apps)
      label: 'remark-math can be inconsistent between docs and apps',
      dependencies: ['remark-math'],
      isIgnored: true,
    },
    {
      // Mastra uses zod v4, while the existing chat and GraphQL runtimes remain on zod v3.
      // Keep this branch from forcing a repo-wide zod major upgrade.
      label: 'zod can differ between Mastra chat-engine and existing runtimes',
      dependencies: ['zod'],
      isIgnored: true,
    },
  ],
  sortAz: [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'resolutions',
    'scripts',
  ],
  sortFirst: [
    'private',
    'name',
    'description',
    'version',
    'repository',
    'homepage',
    'bugs',
    'license',
    'main',
    'types',
    'files',
    'maintainers',
    'contributors',
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'scripts',
    'resolutions',
    'engines',
    'volta',
    'packageManager',
  ],
  // source: [
  //   'package.json',
  //   'apps/*/package.json',
  //   'packages/*/package.json',
  //   'cypress/package.json',
  //   'docs/package.json',
  // ],
}
