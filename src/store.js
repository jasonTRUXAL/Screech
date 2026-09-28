// tiny json "database" because a real database is still too much work
// every read goes to disk and every change goes through update(), which is
// synchronous, so two handlers can never overwrite each other with stale data
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

function createStore(fileName, defaults, normalize = data => data) {
  const filePath = path.join(DATA_DIR, fileName);

  // data files used to live in the repo root; carry them over once
  function migrateLegacyFile() {
    const legacyPath = path.join(ROOT_DIR, fileName);
    if (!fs.existsSync(filePath) && fs.existsSync(legacyPath)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.copyFileSync(legacyPath, filePath);
      console.log(`[STORE] migrated ${fileName} into data/`);
    }
  }

  function read() {
    migrateLegacyFile();
    let data = structuredClone(defaults);
    if (fs.existsSync(filePath)) {
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        console.error(`[STORE] error reading ${fileName}, using defaults:`, err);
      }
    }
    return normalize(data);
  }

  // write to a temp file then rename, so a crash mid-write can't leave half a json file
  function write(data) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
  }

  // read fresh, let the caller change it, save it, hand it back
  function update(mutate) {
    const data = read();
    mutate(data);
    write(data);
    return data;
  }

  return { read, write, update };
}

module.exports = { createStore };
