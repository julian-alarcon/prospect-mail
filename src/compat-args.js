// Pure helpers for editing Chromium "--name=value" process arguments.
// Kept free of Electron imports so they can be unit tested with node --test.

function argsWithoutSwitch(args, name) {
  const prefix = `--${name}=`;
  return args.filter((arg) => arg !== `--${name}` && !arg.startsWith(prefix));
}

function argsWithSwitch(args, name, value) {
  return [...argsWithoutSwitch(args, name), `--${name}=${value}`];
}

module.exports = { argsWithSwitch, argsWithoutSwitch };
