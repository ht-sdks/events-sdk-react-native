# Agent Instructions

This file provides instructions for AI agents working on this React Native monorepo.

## Project Overview

- **Language**: TypeScript
- **Runtime**: Node.js (v20 required in CI)
- **Package Manager**: Yarn 4.1.0 (via Corepack)
- **Monorepo**: Yarn Workspaces
- **Testing**: Jest
- **Linting**: ESLint + Prettier
- **Build**: react-native-builder-bob

### Project Structure

```
packages/
  shared/                                  # @ht-sdks/analytics-rn-shared (private, shared dev code)
  sovran/                                  # @ht-sdks/sovran-react-native (published)
  core/                                    # @ht-sdks/events-sdk-react-native (published)
  plugins/
    plugin-adjust/                         # @ht-sdks/events-sdk-react-native-plugin-adjust
    plugin-advertising-id/                 # @ht-sdks/events-sdk-react-native-plugin-advertising-id
    plugin-amplitudeSession/               # @ht-sdks/events-sdk-react-native-plugin-amplitudeSession
    plugin-appsflyer/                      # @ht-sdks/events-sdk-react-native-plugin-appsflyer
    plugin-branch/                         # @ht-sdks/events-sdk-react-native-plugin-branch
    plugin-braze/                          # @ht-sdks/events-sdk-react-native-plugin-braze
    plugin-braze-middleware/               # @ht-sdks/events-sdk-react-native-plugin-braze-middleware
    plugin-clevertap/                      # @ht-sdks/events-sdk-react-native-plugin-clevertap
    plugin-destination-filters/            # @ht-sdks/events-sdk-react-native-plugin-destination-filters
    plugin-device-token/                   # @ht-sdks/events-sdk-react-native-plugin-device-token
    plugin-facebook-app-events/            # @ht-sdks/events-sdk-react-native-plugin-facebook-app-events
    plugin-firebase/                       # @ht-sdks/events-sdk-react-native-plugin-firebase
    plugin-idfa/                           # @ht-sdks/events-sdk-react-native-plugin-idfa
    plugin-mixpanel/                       # @ht-sdks/events-sdk-react-native-plugin-mixpanel
    plugin-onetrust/                       # @ht-sdks/events-sdk-react-native-plugin-onetrust
examples/
  AnalyticsReactNativeExample/             # Example app
  E2E/                                     # Detox E2E tests
  E2E-73/                                  # Detox E2E tests (RN 0.73)
  E2E-81/                                  # Detox E2E tests (RN 0.81)
  E2E-82/                                  # Detox E2E tests (RN 0.82)
```

### Package Dependencies

```
core ──► sovran
core ──► shared (dev)
plugins/* ──► core (peer)
plugins/* ──► shared (dev)
```

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

## Package-Specific Notes

### Shared Package (`packages/shared`)

Private internal package providing shared dev tooling (jest config base, etc.). Not published.

### Sovran Package (`packages/sovran`)

Cross-platform state management. Foundation package with no internal Hightouch dependencies. Update this first when doing cross-package upgrades.

```bash
cd packages/sovran
yarn build
yarn test
```

### Core Package (`packages/core`)

Main SDK package. Depends on `sovran`. Has a `prebuild` step that generates `src/info.ts` via `constants-generator.js`.

```bash
cd packages/core
yarn build   # Runs prebuild (generates info.ts) then bob build
yarn test
```

**Generated file**: `src/info.ts` is auto-generated from `package.json` version during prebuild. Do not edit it manually.

### Plugin Packages (`packages/plugins/*`)

All plugins depend on core as a peer dependency. After updating core, verify plugins still build:

```bash
# Build and test all packages (from repo root)
yarn build
yarn test
```

---

## Version Bumping

### Semantic Versioning

- **PATCH** (1.0.1 → 1.0.2): Bug fixes, dependency updates, no new features
- **MINOR** (1.0.1 → 1.1.0): New backwards-compatible features
- **MAJOR** (1.0.1 → 2.0.0): Breaking API changes

Dependency updates are typically **PATCH** bumps.

### Release Process

Releases are managed via `@anolilab/multi-semantic-release` with conventional commits. Tag format: `${name}-v${version}`.

---

## CI/CD

- CI config: `.github/workflows/ci.yml`
- Runs on Node 20 with Yarn 4.1.0 (Corepack)
- Steps: `yarn install --immutable`, `yarn build`, `yarn lint`, `yarn test --coverage`
- E2E tests run separately on macOS for iOS (Detox + Xcode) and Android (Detox + Android emulator)

### CI Failures After Dependency Updates

1. **TypeScript errors**: Check type definitions changed in updated packages
2. **Test failures**: Review changelog of updated packages for breaking changes
3. **Lint errors**: New ESLint rules may be introduced; run `yarn lint` and fix issues
4. **Lockfile mismatch**: CI uses `--immutable`; commit `yarn.lock` changes

---

## Common Issues

### Corepack / Yarn Version

This repo requires Yarn 4.1.0 via the `packageManager` field in root `package.json`. Always enable Corepack before running Yarn commands:

```bash
corepack enable
```

If you see errors about Yarn version mismatches, run:

```bash
corepack prepare yarn@4.1.0 --activate
```

### Breaking API Changes

When upgrading major versions, APIs may change. Search for usages:

```bash
# Find all usages of a changed API
grep -r "oldApiName" packages/*/src --include="*.ts"

# Update imports if package restructured
grep -r "from 'package/old-path'" packages/*/src --include="*.ts"
```

### Peer Dependency Conflicts

Plugin packages have peer dependencies on core. If you update core's major version:

1. Update `peerDependencies` in all `packages/plugins/*/package.json`
2. Ensure version ranges are compatible

### Prettier Formatting

The `.prettierrc.js` and `.eslintrc.js` both configure Prettier with `trailingComma: 'es5'`. If upgrading Prettier:

1. Verify the `trailingComma` setting is preserved (Prettier 3.x changed the default to `"all"`)
2. Only format files you actually changed to avoid massive diffs

### Build Order Matters

The linter depends on TypeScript type information from build output. Always run `yarn build` before `yarn lint`.

---

## Workspace Commands

### Running Commands in All Packages

```bash
# Build all (topological order, handles dependencies)
yarn build

# Test all
yarn test

# Lint all
yarn lint

# Clean all
yarn clean
```

### Running Commands in Specific Package

```bash
# Option 1: Use workspace command
yarn workspace @ht-sdks/events-sdk-react-native test

# Option 2: Use the shortcut scripts in root package.json
yarn core test
yarn sovran test

# Option 3: Change directory
cd packages/core && yarn test
```

### Installing Dependencies

```bash
# Add to root (shared dev dependency)
yarn add -D <package>

# Add to specific workspace
yarn workspace @ht-sdks/events-sdk-react-native add <package>

# Add to specific workspace as dev dependency
yarn workspace @ht-sdks/events-sdk-react-native add -D <package>
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `yarn install --immutable` |
| Install (fresh) | `yarn clean && yarn install` |
| Build all | `yarn build` |
| Test all | `yarn test` |
| Test with coverage | `yarn test --coverage` |
| Lint all | `yarn lint` |
| Clean all | `yarn clean` |
| Check outdated | `yarn outdated` |
| Security audit | `yarn npm audit` |
| Update package | `yarn up <package>` |
| Interactive update | `yarn upgrade-interactive` |

---

## Development Tips

### Testing Single File

```bash
# Run a specific test file
yarn test packages/core/src/__tests__/test-utils.test.ts

# Run tests matching a pattern
yarn test --testNamePattern="should track events"
```

### Debugging

```bash
# Run tests with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then attach VS Code or Chrome DevTools.

### E2E Testing (requires macOS)

E2E tests use Detox and require either macOS (for iOS) or an Android emulator:

```bash
# iOS E2E (macOS only)
yarn e2e install
yarn e2e pods
yarn e2e build:ios
yarn e2e test:ios

# Android E2E
yarn e2e install
yarn e2e build:android
yarn e2e test:android
```
