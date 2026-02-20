const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'bookings.db');
const AVATAR_UPLOAD_DIR = path.join(ROOT, 'public', 'uploads', 'avatars');
const AVATAR_URL_PREFIX = '/sitesh/uploads/avatars/';

const MIME_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function parseDataImageUrl(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, '');
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) return null;

  try {
    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) return null;
    return { mimeType, ext, buffer };
  } catch {
    return null;
  }
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function main() {
  fs.mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });

  const db = new sqlite3.Database(DB_PATH);

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const users = await all(db, 'SELECT id, avatar_url FROM users');
    scanned = users.length;

    await run(db, 'BEGIN TRANSACTION');

    for (const user of users) {
      const raw = user.avatar_url || '';
      if (!raw) {
        skipped += 1;
        continue;
      }

      const parsed = parseDataImageUrl(raw);
      if (!parsed) {
        skipped += 1;
        continue;
      }

      const filename = `${user.id}-${Date.now()}-${crypto.randomUUID()}.${parsed.ext}`;
      const diskPath = path.join(AVATAR_UPLOAD_DIR, filename);
      const url = `${AVATAR_URL_PREFIX}${filename}`;

      try {
        fs.writeFileSync(diskPath, parsed.buffer);
        await run(db, 'UPDATE users SET avatar_url = ? WHERE id = ?', [url, user.id]);
        migrated += 1;
      } catch (err) {
        failed += 1;
        if (fs.existsSync(diskPath)) {
          try { fs.unlinkSync(diskPath); } catch {}
        }
        console.error(`Failed to migrate avatar for user ${user.id}: ${err.message}`);
      }
    }

    if (failed > 0) {
      await run(db, 'ROLLBACK');
      console.error('Migration rolled back because some rows failed.');
      process.exitCode = 1;
    } else {
      await run(db, 'COMMIT');
    }
  } catch (err) {
    try { await run(db, 'ROLLBACK'); } catch {}
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await close(db);
  }

  console.log('Avatar migration summary:');
  console.log(`- Users scanned: ${scanned}`);
  console.log(`- Migrated: ${migrated}`);
  console.log(`- Skipped: ${skipped}`);
  console.log(`- Failed: ${failed}`);
}

main();
