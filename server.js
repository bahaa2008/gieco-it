const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const APP_ROOT = __dirname;
const DB_FILE = path.join(APP_ROOT, 'sqlite.db');
const LEGACY_JSON_FILE = path.join(APP_ROOT, 'data', 'f-it-01-01-records.json');

const requiredFields = [
  'deviceName',
  'deviceCode',
  'deviceModel',
  'originCountry',
  'serialNumber',
  'voltAmpere',
  'deviceAmpere',
  'deviceUser',
  'maintenancePlan',
];

const initialRecords = [
  {
    deviceName: 'حاسب مكتبي - الإدارة',
    deviceCode: 'PC-001',
    deviceModel: 'OptiPlex 7000',
    originCountry: 'الصين',
    serialNumber: 'SN-4451',
    voltAmpere: '220V',
    deviceAmpere: '3A',
    deviceUser: 'قسم تقنية المعلومات',
    maintenancePlan: 'ربع سنوي',
  },
  {
    deviceName: 'حاسب محمول - المبيعات',
    deviceCode: 'LAP-014',
    deviceModel: 'Latitude 5520',
    originCountry: 'ماليزيا',
    serialNumber: 'SN-8942',
    voltAmpere: '220V',
    deviceAmpere: '2A',
    deviceUser: 'فريق المبيعات',
    maintenancePlan: 'نصف سنوي',
  },
];

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function runSql(sql) {
  execFileSync('sqlite3', [DB_FILE, sql], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function getSqlValue(sql) {
  return execFileSync('sqlite3', ['-batch', '-noheader', DB_FILE, sql], { encoding: 'utf8' }).trim();
}

function parseCsvRow(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"' && inQuotes) {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function allSqlRows(sql) {
  const out = execFileSync('sqlite3', ['-header', '-csv', DB_FILE, sql], { encoding: 'utf8' }).trim();
  if (!out) {
    return [];
  }

  const lines = out.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvRow(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    return row;
  });
}

function initSchema() {
  runSql(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS maintenance_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      device_code TEXT NOT NULL,
      device_model TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      volt_ampere TEXT NOT NULL,
      device_ampere TEXT NOT NULL,
      maintenance_plan_id INTEGER,
      user_id INTEGER,
      country_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (maintenance_plan_id) REFERENCES maintenance_plans(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (country_id) REFERENCES countries(id)
    );
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL UNIQUE,
      device_name TEXT NOT NULL,
      device_code TEXT NOT NULL,
      maintenance_plan TEXT NOT NULL,
      dates_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);
}

function normalizeRecord(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value || '').trim()]));
}

function isRecordPayloadValid(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }
  return requiredFields.every((field) => typeof record[field] === 'string');
}

function isBulkPayloadValid(payload) {
  return Array.isArray(payload) && payload.length > 0 && payload.every(isRecordPayloadValid);
}

function parsePositiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function addMonthsToDate(date, months) {
  const d = new Date(date.getTime());
  const originalDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(originalDay, maxDay));
  return d;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function resolveIntervalMonths(rate) {
  const normalized = String(rate || '').trim().toLowerCase();
  const map = {
    'شهري': 1,
    'كل شهرين': 2,
    'ربع سنوي': 3,
    'نصف سنوي': 6,
    'سنوي': 12,
    monthly: 1,
    bimonthly: 2,
    quarterly: 3,
    semiannual: 6,
    yearly: 12,
    annual: 12,
  };

  if (map[normalized]) {
    return map[normalized];
  }

  return parsePositiveInteger(rate);
}

function buildPreventiveSchedule(payload) {
  const startDateRaw = String(payload.startDate || '').trim();
  const endDateRaw = String(payload.endDate || '').trim();
  const maintenanceRate = payload.maintenanceRate;

  const startDate = new Date(`${startDateRaw}T00:00:00.000Z`);
  const endDate = new Date(`${endDateRaw}T00:00:00.000Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid dates');
  }

  if (startDate > endDate) {
    throw new Error('Start date must be before or equal to end date');
  }

  const intervalMonths = resolveIntervalMonths(maintenanceRate);
  if (!intervalMonths) {
    throw new Error('Invalid maintenance rate');
  }

  const title = String(payload.title || 'خطة الصيانة الوقائية').trim();
  const assetName = String(payload.assetName || '').trim();

  const events = [];
  let cursor = startDate;
  let index = 1;

  while (cursor <= endDate) {
    events.push({
      line: index,
      eventDate: toIsoDate(cursor),
      details: `${title}${assetName ? ` - ${assetName}` : ''}`,
      maintenanceRate: String(maintenanceRate),
      intervalMonths,
    });

    cursor = addMonthsToDate(cursor, intervalMonths);
    index += 1;
  }

  return {
    title,
    assetName,
    maintenanceRate: String(maintenanceRate),
    intervalMonths,
    startDate: startDateRaw,
    endDate: endDateRaw,
    totalEvents: events.length,
    events,
  };
}

function ensureLookupId(table, value) {
  if (!value) {
    return null;
  }

  const escaped = escapeSql(value);
  runSql(`INSERT OR IGNORE INTO ${table} (name) VALUES ('${escaped}');`);
  const id = getSqlValue(`SELECT id FROM ${table} WHERE name = '${escaped}' LIMIT 1;`);
  return id ? Number(id) : null;
}

function toApiRecord(row) {
  return {
    id: row.id,
    deviceName: row.deviceName,
    deviceCode: row.deviceCode,
    deviceModel: row.deviceModel,
    originCountry: row.originCountry || '',
    serialNumber: row.serialNumber,
    voltAmpere: row.voltAmpere,
    deviceAmpere: row.deviceAmpere,
    deviceUser: row.deviceUser || '',
    maintenancePlan: row.maintenancePlan || '',
  };
}

function listUsers() {
  return allSqlRows(`
    SELECT id, name
    FROM users
    ORDER BY name COLLATE NOCASE ASC;
  `).map((row) => ({ id: Number(row.id), name: row.name }));
}

function createUser(name) {
  const normalized = String(name || '').trim();
  if (!normalized) {
    return null;
  }

  runSql(`INSERT OR IGNORE INTO users (name) VALUES ('${escapeSql(normalized)}');`);
  const row = allSqlRows(`SELECT id, name FROM users WHERE name = '${escapeSql(normalized)}' LIMIT 1;`)[0];
  return row ? { id: Number(row.id), name: row.name } : null;
}

function updateUser(userId, name) {
  const normalized = String(name || '').trim();
  if (!normalized) {
    return null;
  }

  runSql(`UPDATE users SET name = '${escapeSql(normalized)}' WHERE id = ${Number(userId)};`);
  const row = allSqlRows(`SELECT id, name FROM users WHERE id = ${Number(userId)} LIMIT 1;`)[0];
  return row ? { id: Number(row.id), name: row.name } : null;
}

function deleteUser(userId) {
  const usage = Number(getSqlValue(`SELECT COUNT(*) FROM devices WHERE user_id = ${Number(userId)};`) || '0');
  if (usage > 0) {
    return { ok: false, reason: 'in_use' };
  }

  runSql(`DELETE FROM users WHERE id = ${Number(userId)};`);
  return { ok: true };
}

function listRecords() {
  const rows = allSqlRows(`
    SELECT
      d.id,
      d.device_name AS deviceName,
      d.device_code AS deviceCode,
      d.device_model AS deviceModel,
      d.serial_number AS serialNumber,
      d.volt_ampere AS voltAmpere,
      d.device_ampere AS deviceAmpere,
      c.name AS originCountry,
      u.name AS deviceUser,
      m.name AS maintenancePlan
    FROM devices d
    LEFT JOIN countries c ON c.id = d.country_id
    LEFT JOIN users u ON u.id = d.user_id
    LEFT JOIN maintenance_plans m ON m.id = d.maintenance_plan_id
    ORDER BY d.created_at DESC, d.rowid DESC;
  `);

  return rows.map(toApiRecord);
}

function insertRecord(payload, forcedId = null) {
  const normalized = normalizeRecord(payload);
  const maintenancePlanId = ensureLookupId('maintenance_plans', normalized.maintenancePlan);
  const userId = ensureLookupId('users', normalized.deviceUser);
  const countryId = ensureLookupId('countries', normalized.originCountry);
  const id = forcedId || crypto.randomUUID();

  runSql(`
    INSERT INTO devices (
      id, device_name, device_code, device_model,
      serial_number, volt_ampere, device_ampere,
      maintenance_plan_id, user_id, country_id, created_at, updated_at
    )
    VALUES (
      '${escapeSql(id)}',
      '${escapeSql(normalized.deviceName)}',
      '${escapeSql(normalized.deviceCode)}',
      '${escapeSql(normalized.deviceModel)}',
      '${escapeSql(normalized.serialNumber)}',
      '${escapeSql(normalized.voltAmpere)}',
      '${escapeSql(normalized.deviceAmpere)}',
      ${maintenancePlanId ?? 'NULL'},
      ${userId ?? 'NULL'},
      ${countryId ?? 'NULL'},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  `);

  return { id, ...normalized };
}

function updateRecord(id, payload) {
  const normalized = normalizeRecord(payload);
  const maintenancePlanId = ensureLookupId('maintenance_plans', normalized.maintenancePlan);
  const userId = ensureLookupId('users', normalized.deviceUser);
  const countryId = ensureLookupId('countries', normalized.originCountry);

  runSql(`
    UPDATE devices
    SET
      device_name = '${escapeSql(normalized.deviceName)}',
      device_code = '${escapeSql(normalized.deviceCode)}',
      device_model = '${escapeSql(normalized.deviceModel)}',
      serial_number = '${escapeSql(normalized.serialNumber)}',
      volt_ampere = '${escapeSql(normalized.voltAmpere)}',
      device_ampere = '${escapeSql(normalized.deviceAmpere)}',
      maintenance_plan_id = ${maintenancePlanId ?? 'NULL'},
      user_id = ${userId ?? 'NULL'},
      country_id = ${countryId ?? 'NULL'},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = '${escapeSql(id)}';
  `);

  const row = allSqlRows(`
    SELECT
      d.id,
      d.device_name AS deviceName,
      d.device_code AS deviceCode,
      d.device_model AS deviceModel,
      d.serial_number AS serialNumber,
      d.volt_ampere AS voltAmpere,
      d.device_ampere AS deviceAmpere,
      c.name AS originCountry,
      u.name AS deviceUser,
      m.name AS maintenancePlan
    FROM devices d
    LEFT JOIN countries c ON c.id = d.country_id
    LEFT JOIN users u ON u.id = d.user_id
    LEFT JOIN maintenance_plans m ON m.id = d.maintenance_plan_id
    WHERE d.id = '${escapeSql(id)}'
    LIMIT 1;
  `)[0];

  return row ? toApiRecord(row) : null;
}

function isWorkOrderPayloadValid(payload) {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const deviceId = String(payload.deviceId || '').trim();
  const deviceName = String(payload.deviceName || '').trim();
  const deviceCode = String(payload.deviceCode || '').trim();
  const maintenancePlan = String(payload.maintenancePlan || '').trim();
  const dates = payload.dates;

  return (
    Boolean(deviceId) &&
    Boolean(deviceName) &&
    Boolean(deviceCode) &&
    Boolean(maintenancePlan) &&
    Array.isArray(dates) &&
    dates.length > 0 &&
    dates.every((item) => String(item || '').trim().length > 0)
  );
}

function toApiWorkOrder(row) {
  let dates = [];
  try {
    const parsed = JSON.parse(row.dates_json || '[]');
    if (Array.isArray(parsed)) {
      dates = parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    dates = [];
  }

  return {
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceCode: row.device_code,
    maintenancePlan: row.maintenance_plan,
    dates,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getWorkOrderByDeviceId(deviceId) {
  const row = allSqlRows(`
    SELECT
      id,
      device_id,
      device_name,
      device_code,
      maintenance_plan,
      dates_json,
      created_at,
      updated_at
    FROM work_orders
    WHERE device_id = '${escapeSql(deviceId)}'
    LIMIT 1;
  `)[0];

  return row ? toApiWorkOrder(row) : null;
}

function listWorkOrders() {
  return allSqlRows(`
    SELECT
      id,
      device_id,
      device_name,
      device_code,
      maintenance_plan,
      dates_json,
      created_at,
      updated_at
    FROM work_orders
    ORDER BY updated_at DESC, rowid DESC;
  `).map(toApiWorkOrder);
}

function upsertWorkOrder(payload) {
  const normalizedDeviceId = String(payload.deviceId || '').trim();
  const normalizedDeviceName = String(payload.deviceName || '').trim();
  const normalizedDeviceCode = String(payload.deviceCode || '').trim();
  const normalizedMaintenancePlan = String(payload.maintenancePlan || '').trim();
  const normalizedDates = payload.dates.map((item) => String(item || '').trim()).filter(Boolean);

  const deviceExists = Number(
    getSqlValue(`SELECT COUNT(*) FROM devices WHERE id = '${escapeSql(normalizedDeviceId)}';`) || '0',
  );
  if (deviceExists === 0) {
    throw new Error('Device not found');
  }

  const existing = getWorkOrderByDeviceId(normalizedDeviceId);
  const id = existing?.id || crypto.randomUUID();

  if (existing) {
    runSql(`
      UPDATE work_orders
      SET
        device_name = '${escapeSql(normalizedDeviceName)}',
        device_code = '${escapeSql(normalizedDeviceCode)}',
        maintenance_plan = '${escapeSql(normalizedMaintenancePlan)}',
        dates_json = '${escapeSql(JSON.stringify(normalizedDates))}',
        updated_at = CURRENT_TIMESTAMP
      WHERE device_id = '${escapeSql(normalizedDeviceId)}';
    `);
  } else {
    runSql(`
      INSERT INTO work_orders (
        id,
        device_id,
        device_name,
        device_code,
        maintenance_plan,
        dates_json,
        created_at,
        updated_at
      )
      VALUES (
        '${escapeSql(id)}',
        '${escapeSql(normalizedDeviceId)}',
        '${escapeSql(normalizedDeviceName)}',
        '${escapeSql(normalizedDeviceCode)}',
        '${escapeSql(normalizedMaintenancePlan)}',
        '${escapeSql(JSON.stringify(normalizedDates))}',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    `);
  }

  return getWorkOrderByDeviceId(normalizedDeviceId);
}

function seedIfEmpty() {
  const count = Number(getSqlValue('SELECT COUNT(*) FROM devices;') || '0');
  if (count > 0) {
    return;
  }

  initialRecords.forEach((record) => insertRecord(record));
}

async function migrateLegacyJsonIfPresent() {
  if (!require('node:fs').existsSync(LEGACY_JSON_FILE)) {
    return;
  }

  try {
    const raw = require('node:fs').readFileSync(LEGACY_JSON_FILE, 'utf8');
    const records = JSON.parse(raw);

    if (!Array.isArray(records)) {
      return;
    }

    records.filter(isRecordPayloadValid).forEach((record) => insertRecord(record));
    require('node:fs').renameSync(LEGACY_JSON_FILE, `${LEGACY_JSON_FILE}.migrated`);
  } catch {
    // Ignore migration errors.
  }
}

async function initializeDatabase() {
  initSchema();
  await migrateLegacyJsonIfPresent();
  seedIfEmpty();
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api/f-it-01-02-schedule', (req, res) => {
  res.status(405).json({ error: 'Method not allowed' });
});

app.post('/api/f-it-01-02-schedule', (req, res) => {
  try {
    res.status(200).json(buildPreventiveSchedule(req.body || {}));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid payload' });
  }
});

app.get('/api/users', (req, res) => {
  res.status(200).json(listUsers());
});

app.post('/api/users', (req, res) => {
  const created = createUser(req.body?.name);
  if (!created) {
    return res.status(400).json({ error: 'Invalid user payload' });
  }
  return res.status(201).json(created);
});

app.put('/api/users/:userId', (req, res) => {
  const updated = updateUser(req.params.userId, req.body?.name);
  if (!updated) {
    return res.status(400).json({ error: 'Invalid user payload' });
  }
  return res.status(200).json(updated);
});

app.delete('/api/users/:userId', (req, res) => {
  const result = deleteUser(req.params.userId);
  if (!result.ok && result.reason === 'in_use') {
    return res.status(409).json({ error: 'Cannot delete user with linked devices' });
  }
  return res.status(204).send();
});

app.post('/api/f-it-01-01-records/bulk', (req, res) => {
  if (!isBulkPayloadValid(req.body)) {
    return res.status(400).json({ error: 'Invalid bulk payload' });
  }

  return res.status(201).json(req.body.map((item) => insertRecord(item)));
});

app.get('/api/f-it-01-01-records', (req, res) => {
  res.status(200).json(listRecords());
});

app.post('/api/f-it-01-01-records', (req, res) => {
  if (!isRecordPayloadValid(req.body)) {
    return res.status(400).json({ error: 'Invalid record payload' });
  }

  return res.status(201).json(insertRecord(req.body));
});

app.put('/api/f-it-01-01-records/:recordId', (req, res) => {
  if (!isRecordPayloadValid(req.body)) {
    return res.status(400).json({ error: 'Invalid record payload' });
  }

  const updated = updateRecord(req.params.recordId, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Record not found' });
  }

  return res.status(200).json(updated);
});

app.delete('/api/f-it-01-01-records/:recordId', (req, res) => {
  const recordId = req.params.recordId;
  runSql(`DELETE FROM devices WHERE id = '${escapeSql(recordId)}';`);
  const exists = Number(getSqlValue(`SELECT COUNT(*) FROM devices WHERE id = '${escapeSql(recordId)}';`) || '0');
  if (exists > 0) {
    return res.status(500).json({ error: 'Failed to delete record' });
  }
  return res.status(204).send();
});

app.get('/api/f-it-01-03-work-orders', (req, res) => {
  const deviceId = String(req.query.deviceId || '').trim();
  if (deviceId) {
    const item = getWorkOrderByDeviceId(deviceId);
    return res.status(200).json(item || null);
  }

  return res.status(200).json(listWorkOrders());
});

app.post('/api/f-it-01-03-work-orders', (req, res) => {
  if (!isWorkOrderPayloadValid(req.body)) {
    return res.status(400).json({ error: 'Invalid work order payload' });
  }

  try {
    const saved = upsertWorkOrder(req.body);
    return res.status(201).json(saved);
  } catch (error) {
    if (error?.message === 'Device not found') {
      return res.status(404).json({ error: 'Device not found' });
    }
    return res.status(400).json({ error: 'Failed to save work order' });
  }
});

const legacyRoutes = {
  '/F-IT-01-01.html': '/page/f-it-01-01',
  '/F-IT-01-02.html': '/page/f-it-01-02',
  '/F-IT-01-03.html': '/page/f-it-01-03',
  '/F-IT-01-04.html': '/page/f-it-01-04',
  '/F-IT-01-05.html': '/page/f-it-01-05',
  '/F-IT-01-06.html': '/page/f-it-01-06',
  '/F-IT-01-07.html': '/page/f-it-01-07',
  '/F-IT-01-08.html': '/page/f-it-01-08',
  '/F-IT-01-09.html': '/page/f-it-01-09',
  '/F-IT-01-10.html': '/page/f-it-01-10',
  '/users-management.html': '/page/users-management',
};

Object.entries(legacyRoutes).forEach(([from, to]) => {
  app.get(from, (req, res) => {
    res.redirect(301, to);
  });
});

app.use(express.static(APP_ROOT));

app.use((req, res) => {
  res.status(404).type('text/plain').send('Not Found');
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Express server running at http://${HOST}:${PORT}`);
      console.log(`SQLite DB: ${DB_FILE}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
