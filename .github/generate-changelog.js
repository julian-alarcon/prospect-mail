#!/usr/bin/env node

const { execSync } = require('child_process');

// Get tag range from arguments
const currentTag = process.argv[2];
const previousTag = process.argv[3];

// Get repository URL from git remote
const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
// Convert SSH URL to HTTPS (e.g., git@github.com:user/repo.git -> https://github.com/user/repo)
const repoUrl = remoteUrl
  .replace(/^git@([^:]+):/, 'https://$1/')
  .replace(/\.git$/, '');

// Define categories with emojis
const categories = {
  'breaking': { title: '### 🚨 Breaking Changes', commits: [] },
  'security': { title: '### 🔒 Security', commits: [] },
  'feat': { title: '### 🚀 Features', commits: [] },
  'fix': { title: '### 🐛 Bug Fixes', commits: [] },
  'perf': { title: '### 🌟 Enhancements', commits: [] },
  'docs': { title: '### 📚 Documentation', commits: [] },
  'build': { title: '### 🔧 Build & CI', commits: [] },
  'chore': { title: '### 🧹 Chores & Maintenance', commits: [] },
};

// Get commits between tags
const range = previousTag ? `${previousTag}..${currentTag}` : currentTag;
const gitLog = execSync(`git log ${range} --no-merges --pretty=format:"%h|%s"`, { encoding: 'utf-8' });

// Parse and categorize commits
gitLog.split('\n').forEach(line => {
  if (!line) return;

  const [hash, message] = line.split('|');

  // Check for breaking changes (with ! or explicit BREAKING CHANGE/BREAKING CHANGES)
  if (message.match(/^(breaking|BREAKING CHANGES?):/i) ||
      message.match(/^(feat|fix|refactor|perf|build|chore|docs|ci|style|test)!(\(.*\))?:/i) ||
      message.includes('BREAKING CHANGE:') ||
      message.includes('BREAKING CHANGES:')) {
    categories.breaking.commits.push({ hash, message });
  }
  // Check for security
  else if (message.match(/^(security|sec)(\(.*\))?:/i)) {
    categories.security.commits.push({ hash, message });
  }
  // Check for features
  else if (message.match(/^feat(\(.*\))?:/i)) {
    categories.feat.commits.push({ hash, message });
  }
  // Check for fixes
  else if (message.match(/^fix(\(.*\))?:/i)) {
    categories.fix.commits.push({ hash, message });
  }
  // Check for performance/improvements
  else if (message.match(/^(perf|improve|enhancement)(\(.*\))?:/i)) {
    categories.perf.commits.push({ hash, message });
  }
  // Check for docs
  else if (message.match(/^docs(\(.*\))?:/i)) {
    categories.docs.commits.push({ hash, message });
  }
  // Check for build/ci
  else if (message.match(/^(build|ci)(\(.*\))?:/i)) {
    categories.build.commits.push({ hash, message });
  }
  // Check for chores
  else if (message.match(/^(chore|refactor|style|test|misc)(\(.*\))?:/i)) {
    categories.chore.commits.push({ hash, message });
  }
});

// Build changelog
let changelog = '';

Object.values(categories).forEach(category => {
  if (category.commits.length > 0) {
    changelog += `${category.title}\n\n`;
    category.commits.forEach(commit => {
      // Remove the type prefix from the message for cleaner display
      let cleanMessage = commit.message.replace(/^[^:]+:\s*/, '');

      // Convert issue references to links (#123 -> [#123](url), owner/repo#123 -> [owner/repo#123](url))
      cleanMessage = cleanMessage.replace(/(?:([\w.-]+\/[\w.-]+))?#(\d+)/g, (match, extRepo, num) =>
        extRepo
          ? `[${extRepo}#${num}](https://github.com/${extRepo}/issues/${num})`
          : `[#${num}](${repoUrl}/issues/${num})`
      );

      changelog += `* ${cleanMessage} ([${commit.hash}](${repoUrl}/commit/${commit.hash}))\n`;
    });
    changelog += '\n';
  }
});

// Output the changelog
console.log(changelog.trim());
