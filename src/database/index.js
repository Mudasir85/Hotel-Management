const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'bookings.db');
const REQUIRED_BOOKING_COLUMNS = [
  { name: 'guest_name', type: 'TEXT NOT NULL' },
  { name: 'guest_phone', type: 'TEXT NOT NULL' },
  { name: 'room_number', type: 'TEXT NOT NULL' },
  { name: 'check_in_date', type: 'DATE NOT NULL' },
  { name: 'check_out_date', type: 'DATE NOT NULL' }
];

const db = new sqlite3.Database(DB_PATH);

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function createCanonicalBookingsTable() {
  return new Promise((resolve, reject) => {
    db.run(
      `
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY,
        guest_name TEXT NOT NULL,
        guest_phone TEXT NOT NULL,
        room_number TEXT NOT NULL,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL
      )
    `,
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

function getTableInfo(tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${quoteIdentifier(tableName)})`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

async function migrateLegacyBookingsTable(currentColumns) {
  const legacyTable = `bookings_legacy_${Date.now()}`;

  await runSql(`ALTER TABLE bookings RENAME TO ${quoteIdentifier(legacyTable)}`);
  await createCanonicalBookingsTable();

  const legacyColumns = await getTableInfo(legacyTable);
  const legacyNames = new Set(legacyColumns.map((col) => col.name));

  const columnAliases = {
    guest_name: ['guest_name', 'guestName', 'name', 'guest'],
    guest_phone: ['guest_phone', 'guestPhone', 'phone', 'mobile'],
    room_number: ['room_number', 'roomNumber', 'room'],
    check_in_date: ['check_in_date', 'checkInDate', 'check_in', 'checkin_date'],
    check_out_date: ['check_out_date', 'checkOutDate', 'check_out', 'checkout_date']
  };

  const selectExpressions = [legacyNames.has('id') ? quoteIdentifier('id') : 'NULL'];

  for (const required of REQUIRED_BOOKING_COLUMNS) {
    const aliases = columnAliases[required.name] || [required.name];
    const source = aliases.find((alias) => legacyNames.has(alias));
    selectExpressions.push(source ? `CAST(${quoteIdentifier(source)} AS TEXT)` : "''");
  }

  const insertQuery = `
    INSERT INTO bookings (id, guest_name, guest_phone, room_number, check_in_date, check_out_date)
    SELECT ${selectExpressions.join(', ')}
    FROM ${quoteIdentifier(legacyTable)}
  `;

  await runSql(insertQuery);
  console.log(`Migrated legacy bookings schema to canonical table (backup: ${legacyTable})`);
}

async function ensureSchema() {
  const table = await new Promise((resolve, reject) => {
    db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bookings'", [], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

  if (!table) {
    await createCanonicalBookingsTable();
    return;
  }

  const columns = await getTableInfo('bookings');
  const existingNames = new Set(columns.map((col) => col.name));
  const requiredNames = new Set(REQUIRED_BOOKING_COLUMNS.map((col) => col.name));
  const missingRequired = REQUIRED_BOOKING_COLUMNS.filter((col) => !existingNames.has(col.name));
  const blockingLegacyColumns = columns.filter(
    (col) => !requiredNames.has(col.name) && col.notnull === 1 && col.dflt_value == null
  );

  if (missingRequired.length > 0 || blockingLegacyColumns.length > 0) {
    await migrateLegacyBookingsTable(columns);
  }
}

async function initDatabase() {
  await new Promise((resolve, reject) => {
    db.get('SELECT 1', [], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

  await ensureSchema();
}

function closeDatabase() {
  return new Promise((resolve) => {
    db.close(() => resolve());
  });
}

module.exports = {
  db,
  initDatabase,
  closeDatabase
};
