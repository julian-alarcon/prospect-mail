const path = require("path");
const fs = require("fs");

const cache = {};
const publicDir = path.resolve(__dirname, "../../public");

module.exports = (relpath) => {
  // Input validation
  if (typeof relpath !== 'string' || !relpath) {
    throw new TypeError('relpath must be a non-empty string');
  }

  if (cache[relpath]) {
    return cache[relpath];
  }

  relpath = relpath.trim();

  // Remove initial . or / to prevent out of bound request
  while (["/", "."].indexOf(relpath.substring(0, 1)) !== -1) {
    relpath = relpath.substring(1);
  }

  // Resolve the full path and validate it's within public directory
  const fullpath = path.resolve(publicDir, relpath);

  // Security: Ensure resolved path is within public directory
  if (!fullpath.startsWith(publicDir + path.sep) && fullpath !== publicDir) {
    throw new Error(
      `Security: ${relpath} attempts to access files outside public directory`
    );
  }

  if (!fs.existsSync(fullpath) || !fs.statSync(fullpath).isFile()) {
    throw new Error(
      `${relpath} is not a valid client file. It must exist in ${fullpath}`
    );
  }

  console.log(`Prepare %o to be injected.`, relpath);
  cache[relpath] = fs.readFileSync(fullpath, 'utf-8');
  return cache[relpath];
};
