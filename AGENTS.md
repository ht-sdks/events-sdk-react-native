# Agent Instructions

This file documents the dependency update workflow for this React Native monorepo.

## Project Overview

- **Language**: TypeScript
- **Runtime**: Node.js (v20 required in CI)
- **Package Manager**: Yarn 4.1.0 (via Corepack)
- **Monorepo**: Yarn Workspaces
- **Testing**: Jest
- **Linting**: ESLint + Prettier
- **Build**: react-native-builder-bob

---

## Updating Dependencies

### 1. Pre-flight Checks

```bash
# Check Node.js version (v20 required, matching CI)
node --version

# Enable Corepack for Yarn 4
corepack enable

# Verify Yarn version matches packageManager field (4.1.0)
yarn --version

# Ensure you're at the repository root
pwd  # Should be: /path/to/events-sdk-react-native
```

### 2. Establish Test Baseline

```bash
# Install dependencies
yarn install --immutable

# Build all packages (topological order, required before lint/tests)
yarn build

# Run linter (depends on build output for TS types)
yarn lint

# Run all tests
yarn test --coverage
```

Record the number of passing tests before making any changes. This ensures you can verify nothing broke after upgrading.

### 3. Check for Security Advisories

```bash
yarn npm audit
```

Review any vulnerabilities. Note that `yarn npm audit` only checks published packages; for a full audit of the dependency tree, you may need to use `yarn dlx audit-ci` or a similar tool.

### 4. Check Outdated Packages

```bash
# Check all dependencies across the monorepo
yarn outdated
```

This shows:
- **Current**: Installed version
- **Wanted**: Latest within current semver range
- **Latest**: Newest available version

### 5. Upgrade Dependencies

#### Option A: Safe Updates (within semver range)

```bash
# Update a specific package across all workspaces
yarn up <package-name>

# Update all instances of a package interactively
yarn up -i <package-name>
```

#### Option B: Major Version Updates

For major version bumps, edit `package.json` files directly:

```bash
# Root package.json for shared dev dependencies
# packages/*/package.json for package-specific dependencies
```

Then reinstall:

```bash
yarn install
```

#### Option C: Interactive Updates (recommended)

Use `yarn upgrade-interactive` for a better upgrade experience:

```bash
# Interactively select which packages to upgrade
yarn upgrade-interactive
```

### 6. Rebuild and Test

```bash
# Clean all build artifacts
yarn clean

# Reinstall dependencies
yarn install

# Rebuild all packages (topological order via workspaces foreach)
yarn build

# Run linter (must run after build, relies on TS types)
yarn lint

# Run all tests with coverage
yarn test --coverage
```

Compare test results to baseline. Fix any failures before proceeding.

### 7. Verify CI Would Pass

The CI runs on Node 20 with Yarn 4.1.0 via Corepack. Replicate the CI steps locally:

```bash
# Match the CI environment
corepack enable
yarn install --immutable
yarn build
yarn lint
yarn test --coverage
```

If `yarn install --immutable` fails, it means the lockfile changed. Run `yarn install` first, commit the updated `yarn.lock`, then verify `--immutable` passes.

---

## Common Issues When Updating Dependencies

### Upgrading Yarn Itself

The Yarn binary is vendored at `.yarn/releases/yarn-4.1.0.cjs` to avoid intermittent CI failures from Corepack network downloads. To upgrade Yarn:

```bash
yarn set version <new-version>
```

This updates three things atomically:
1. `packageManager` in `package.json`
2. `yarnPath` in `.yarnrc.yml`
3. The binary in `.yarn/releases/`

Commit all three changes together. No other maintenance is needed -- the vendored binary only changes when you intentionally bump the Yarn version.

### Corepack / Yarn Version

This repo requires Yarn 4.1.0 via the `packageManager` field in root `package.json`. Always enable Corepack before running Yarn commands:

```bash
corepack enable
```

If you see errors about Yarn version mismatches, run:

```bash
corepack prepare yarn@4.1.0 --activate
```

### Build Order Matters

The linter depends on TypeScript type information from build output. Always run `yarn build` before `yarn lint`.

### CI Failures After Dependency Updates

1. **TypeScript errors**: Check type definitions changed in updated packages
2. **Test failures**: Review changelog of updated packages for breaking changes
3. **Lint errors**: New ESLint rules may be introduced; run `yarn lint` and fix issues
4. **Lockfile mismatch**: CI uses `--immutable`; commit `yarn.lock` changes

### Peer Dependency Conflicts

Plugin packages have peer dependencies on core. If you update core's major version:

1. Update `peerDependencies` in all `packages/plugins/*/package.json`
2. Ensure version ranges are compatible

### Prettier Formatting

The `.prettierrc.js` and `.eslintrc.js` both configure Prettier with `trailingComma: 'es5'`. If upgrading Prettier:

1. Verify the `trailingComma` setting is preserved (Prettier 3.x changed the default to `"all"`)
2. Only format files you actually changed to avoid massive diffs

### Breaking API Changes

When upgrading major versions, APIs may change. Search for usages:

```bash
# Find all usages of a changed API
grep -r "oldApiName" packages/*/src --include="*.ts"

# Update imports if package restructured
grep -r "from 'package/old-path'" packages/*/src --include="*.ts"
```
