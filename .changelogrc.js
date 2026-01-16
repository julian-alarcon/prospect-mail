const config = require('conventional-changelog-conventionalcommits');

module.exports = config({
  types: [
    { type: 'feat', section: '### 🚀 Features' },
    { type: 'feature', section: '### 🚀 Features' },
    { type: 'fix', section: '### 🐛 Bug Fixes' },
    { type: 'perf', section: '### 🌟 Enhancements' },
    { type: 'improve', section: '### 🌟 Enhancements' },
    { type: 'enhancement', section: '### 🌟 Enhancements' },
    { type: 'docs', section: '### 📚 Documentation' },
    { type: 'build', section: '### 🔧 Build & CI' },
    { type: 'ci', section: '### 🔧 Build & CI' },
    { type: 'chore', section: '### 🧹 Chores & Maintenance' },
    { type: 'refactor', section: '### 🧹 Chores & Maintenance' },
    { type: 'style', section: '### 🧹 Chores & Maintenance' },
    { type: 'test', section: '### 🧹 Chores & Maintenance' },
    { type: 'misc', section: '### 🧹 Chores & Maintenance' },
    { type: 'security', section: '### 🔒 Security' },
    { type: 'sec', section: '### 🔒 Security' },
  ],
});
