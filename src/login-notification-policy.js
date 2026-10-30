class LoginNotificationPolicy {
  constructor() {
    this.hasMailSession = false;
    this.notified = false;
    this.lastNotificationAt = -Infinity;
  }

  markMailboxReady() {
    this.hasMailSession = true;
    this.notified = false;
  }

  shouldNotify(reason, { visible, now = Date.now() }) {
    if (!["login-page", "session-expired"].includes(reason) || (!this.hasMailSession && reason !== "session-expired") ||
        visible || this.notified || now - this.lastNotificationAt < 180000) return false;
    this.notified = true;
    this.lastNotificationAt = now;
    return true;
  }
}

module.exports = { LoginNotificationPolicy };
