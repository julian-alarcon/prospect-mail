// Unit tests for the process-argument helpers used by the self-relaunch that
// enforces the rendering backend (Settings > Compatibility).
const test = require("node:test");
const assert = require("node:assert");
const { argsWithSwitch, argsWithoutSwitch } = require("../src/compat-args");

test("adds the switch when none is present", () => {
  assert.deepStrictEqual(argsWithSwitch([".", "--minimized"], "ozone-platform", "x11"), [
    ".",
    "--minimized",
    "--ozone-platform=x11",
  ]);
});

test("replaces an existing value instead of duplicating the switch", () => {
  assert.deepStrictEqual(
    argsWithSwitch(["--ozone-platform=wayland", "--x"], "ozone-platform", "x11"),
    ["--x", "--ozone-platform=x11"]
  );
});

test("removes the switch and keeps everything else", () => {
  assert.deepStrictEqual(
    argsWithoutSwitch([".", "--ozone-platform=x11", "--ozone-platform", "--y"], "ozone-platform"),
    [".", "--y"]
  );
});

test("does not touch switches with a longer name", () => {
  assert.deepStrictEqual(
    argsWithoutSwitch(["--ozone-platform-hint=auto"], "ozone-platform"),
    ["--ozone-platform-hint=auto"]
  );
});
