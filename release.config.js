module.exports = {
  plugins: [
    [
      '@semantic-release/commit-analyzer', 
      { preset: 'conventionalcommits' }
    ],
    '@semantic-release/changelog',
    'semantic-release-yarn',
    [
      '@semantic-release/github',
      {
        // Don't comment "included in version X" on shipped PRs/issues. With
        // multi-semantic-release every package's release comments on the same
        // PRs, so a full release posts ~15 duplicate comments per PR.
        successComment: false
      }
    ]
    // NOTE: @semantic-release/git is intentionally omitted. The default branch
    // ruleset requires pull requests, so the publish workflow opens a PR with
    // the generated CHANGELOG.md and package.json bumps instead of pushing
    // them to master directly. Versions are derived from git tags, so the
    // committed package.json versions are documentation, not a release input.
  ],
  debug: true
};
