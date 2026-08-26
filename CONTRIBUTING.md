# Contributing to Prospect Mail

Thank you for your interest in contributing to Prospect Mail! This document
provides guidelines and information for contributing to the project.

## Code of Conduct

This project welcomes contributions from everyone. Please be respectful and
professional in all interactions. We aim to create a welcoming environment for
all contributors.

## Getting Started

Before you begin:

- Install [git](https://git-scm.com/) and [Node.js](https://nodejs.org/) v24.x LTS
- Read the [README.md](README.md)
- Check existing [issues](https://github.com/julian-alarcon/prospect-mail/issues)
  and [pull requests](https://github.com/julian-alarcon/prospect-mail/pulls) to
  avoid duplicate work

## Development Setup

```shell
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR-USERNAME/prospect-mail.git
cd prospect-mail

# Add upstream remote
git remote add upstream https://github.com/julian-alarcon/prospect-mail.git

# Install and run
npm install
npm start                  # Normal start
npm run start-minimized    # Start minimized
```

### Troubleshooting Sandbox Issues

If you get a SUID sandbox error during development,

```text
The SUID sandbox helper binary was found, but is not configured correctly
```

disable the sandbox:

```shell
# One-time (recommended)
ELECTRON_DISABLE_SANDBOX=1 npm start

# Persistent (add to ~/.bashrc or ~/.zshrc)
export ELECTRON_DISABLE_SANDBOX=1
```

**Note:** This only affects local development. Production builds handle sandboxing correctly.

### Building Linux Packages

Install dependencies for your target format, then build:

```shell
# Snap
sudo snap install snapcraft --classic
npm run dist:linux:snap

# Flatpak
sudo apt install flatpak flatpak-builder
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install -y --system flathub org.freedesktop.{Platform,Sdk}//25.08 org.electronjs.Electron2.BaseApp//25.08
npm run dist:linux:flatpak

# Deb
sudo apt install fakeroot dpkg
npm run dist:linux:deb

# Pacman
sudo apt install libarchive-tools
npm run dist:linux:pacman
```

## Project Structure

```shell
prospect-mail/
├── .github/          # GitHub workflows, issue templates, and configuration
├── build/            # Build assets (icons, etc.)
├── misc/             # Miscellaneous files (screenshots, etc.)
├── public/           # Scripts injected into the Outlook web app (unread observer, etc.)
├── assets/           # Runtime icons (tray, notifications)
├── src/              # Source code
│   ├── controller/   # Application controllers
│   │   ├── about-preload.js
│   │   ├── about-window.js
│   │   ├── client-injector.js
│   │   ├── mail-window-controller.js
│   │   ├── preload.js
│   │   └── tray-controller.js
│   ├── about.html    # About window markup
│   ├── main.js       # Main application entry point
│   └── settings.js   # Centralized settings store (defaults + migration)
├── package.json      # Project configuration and dependencies
└── README.md         # Project documentation
```

## Development Workflow

### Creating a Branch

Create a branch:

```shell
git checkout -b your-feature-fix-branch-name
```

### Making Changes

1. Make your changes in your feature branch
2. Test your changes locally
3. Commit your changes using conventional commit format (see commit prefixes in
   [changelog generation](#automatic-changelog-generation))
4. Keep commits focused and atomic

Examples:

```shell
feat: add support for custom notification sounds
fix: resolve tray icon not appearing on Windows
fix: #123 resolve crash when opening calendar view
```

## Coding Standards

* Use consistent indentation (the project uses JavaScript)
* Follow existing code style and patterns
* Write clear, self-documenting code
* Add comments for complex logic
* Avoid introducing security vulnerabilities (XSS, SQL injection, command injection, etc.)
* Keep changes focused and avoid unnecessary refactoring

## Testing

Before submitting your changes:

1. Test the application locally by running:

```shell
npm start
```

2. Build the application for your platform to ensure there are no build errors:

For Linux:
```shell
npm run dist:linux
```

For macOS:
```shell
npm run dist:mac
```

For Windows:
```shell
npm run dist:windows
```

3. Test the functionality you've added or modified
4. Verify that existing features still work correctly

## Submitting Changes

### Pull Request Process

1. Update your fork with the latest changes from upstream:

```shell
git fetch upstream
git rebase upstream/main
```

2. Push your changes to your fork:

```shell
git push origin your-branch-name
```

3. Create a Pull Request from your fork to the main repository
4. Fill in the pull request template with:
   * A clear description of the changes
   * Reference to related issues (if applicable)
   * Screenshots or videos for UI changes
   * Testing steps

5. Wait for review and address any feedback

### Pull Request Labels

You can optionally add changelog labels to your PR (see
[Automatic Changelog Generation](#automatic-changelog-generation) for the full
list). However, the project primarily uses conventional commit messages to
automatically categorize changes in the release notes.

### Review Process

* Maintainers will review your pull request
* Address any requested changes or feedback
* Once approved, a maintainer will merge your pull request

## Release Process

This section describes how new versions of Prospect Mail are released. This is primarily for maintainers but provides transparency for contributors.

### Version Numbering

The project uses semantic versioning with beta releases: `MAJOR.MINOR.PATCH-beta#`

Example: `0.6.0-beta2`

### Creating a New Release

Always bump the version with `npm version` (never edit `package.json` by hand):
it updates `package.json` and `package-lock.json`, creates the commit, and
creates the matching git tag in one step. The tree must be clean first.

Use explicit version strings so the tag matches the `MAJOR.MINOR.PATCH-beta#`
convention. A typical cycle ships a beta first, then the stable release:

```shell
# 1. Beta (from a clean, up-to-date main)
git checkout main && git pull
npm version 1.3.0-beta1
git push --follow-tags        # pushes the commit and the tag together

# 2. After testing the beta, cut the stable release
git checkout main && git pull
npm version 1.3.0
git push --follow-tags
```

> If `main` is protected (requires PRs), run `npm version` on a short-lived
> branch, open a PR, and push the tag after merge. The tag is what triggers the
> release.

When the tag is pushed, GitHub Actions automatically:

- Generates release notes from commit prefixes (see `.github/release.yml`)
- Creates the GitHub release (marked pre-release for `-beta` tags)
- Builds Linux (x64, arm64): AppImage, deb, pacman, rpm, snap, flatpak, tar.gz
- Builds macOS (arm64, x64): dmg
- Builds Windows (x64, arm64): exe, msi
- Attaches all artifacts to the GitHub release
- Publishes the snap to the Snap Store **beta** channel

Snap always publishes to the **beta** channel (configured in `package.json`),
including stable version tags. To ship a stable snap, promote it manually:

- Go to [Snap Store releases](https://snapcraft.io/prospect-mail/releases)
- Move the release from **beta** to **stable**

> The Snap Store publish step needs a valid `SNAPCRAFT_TOKEN` repository secret.
> These tokens expire; if the release job fails with "Exported credentials are
> no longer valid", rotate it (see [Manual Snap Store Release](#manual-snap-store-release)).

### Automatic Changelog Generation

The project uses [.github/release.yml](.github/release.yml) to automatically
generate release notes. When you click "Generate release notes" during release
creation, GitHub will:

1. Find all commits since the last release
2. Categorize them based on conventional commit prefixes
3. Generate formatted changelog with these sections:

| Commit Prefix                                     | Changelog Section       |
| ------------------------------------------------- | ----------------------- |
| `breaking:`, `BREAKING CHANGE:`, `feat!:`, etc.   | 🚨 Breaking Changes     |
| `security:`, `sec:`                               | 🔒 Security             |
| `feat:`                                           | 🚀 Features             |
| `fix:`                                            | 🐛 Bug Fixes            |
| `enhancement:`, `improve:`, `perf:`               | 🌟 Enhancements         |
| `docs:`                                           | 📚 Documentation        |
| `build:`, `ci:`                                   | 🔧 Build & CI           |
| `chore:`, `misc:`, `refactor:`, `style:`, `test:` | 🧹 Chores & Maintenance |

Note: For breaking changes, you can use the `!` suffix with any commit type
(e.g., `feat!:`, `fix!:`, `refactor!:`) to indicate a breaking change.

### Manual Snap Store Release

If needed, you can manually upload and release a snap:

```shell
snapcraft login
snapcraft upload --release=beta prospect-mail_x.y.z_arch.snap
```

#### Rotating the CI Snap Store token

The automated release uses the `SNAPCRAFT_TOKEN` repository secret. Store tokens
expire, so regenerate and update it when a release job fails to publish:

```shell
snapcraft login
snapcraft export-login \
  --channels beta,stable \
  --acls package_access,package_push,package_release \
  --expires 2027-12-31 \
  snapcraft-token.txt
gh secret set SNAPCRAFT_TOKEN --repo julian-alarcon/prospect-mail < snapcraft-token.txt
rm snapcraft-token.txt
```

> Update the secret **before** re-running a failed job. GitHub injects secrets
> when a job starts, so a re-run that began before the update still uses the old
> token.

## Reporting Issues

### Bug Reports

When reporting bugs, please use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- A clear description of the bug
- Steps to reproduce the issue
- Expected behavior
- Screenshots (if applicable)
- System information:
  - OS (e.g., Ubuntu 24.04, Windows 11, macOS 15)
  - Installation source (deb, rpm, snap, AppImage, tar.gz, Snapstore, exe, msi, dmg)
  - Version (e.g., 0.6.0-beta2)
- Any additional context

Check if the issue occurs with different build types (AppImage, deb, rpm, etc.).

### Security Issues

If you discover a security vulnerability, please report it privately to the
maintainer rather than creating a public issue.

## Feature Requests

When requesting features, please use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
and include:

- A clear description of the problem or use case
- Your proposed solution
- Alternative solutions you've considered
- Version you're using (if applicable)
- Any additional context or screenshots

## Architecture and Dependencies

### Core Components

- **Node.js**: v24.x LTS
- **npm**: (comes with Node.js)
- **Electron**: v42.x (pinned; see `src/controller/tray-controller.js` for why)
- **electron-builder**: v26.x
- **electron-store**: v8.2.0

### Platform-Specific Notes

#### Linux

- Snap builds use `core24` base with strict confinement (built via LXD)
- Flatpak builds use the `25.08` runtime
- Multiple package formats supported: AppImage, deb, pacman, rpm, snap, flatpak, tar.gz
- Architectures: x64, arm64
- Requires `libarchive-tools` for pacman builds

#### macOS

- Builds for arm64 (Apple Silicon) and x64 (Intel)
- Category: productivity
- DMG packaging with no update info

#### Windows

- Builds for x64 and arm64
- NSIS and MSI installers available
- Windows 10+ required

## Getting Help

If you need help or have questions:

- Check the [README.md](README.md) for general documentation
- Look through existing [issues](https://github.com/julian-alarcon/prospect-mail/issues)
- Create a new issue with your question
- Be specific and provide context

## License

By contributing to Prospect Mail, you agree that your contributions will be
licensed under the [MIT License](LICENSE).

---

Thank you for contributing to Prospect Mail!
