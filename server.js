const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const APP_ROOT = __dirname;
const DB_FILE = path.join(APP_ROOT, 'sqlite.db');
const LEGACY_JSON_FILE = path.join(APP_ROOT, 'data', 'f-it-01-01-records.json');

const STATIC_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

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
  const out = execFileSync('sqlite3', ['-batch', '-noheader', DB_FILE, sql], { encoding: 'utf8' }).trim();
  return out;
}

function allSqlJson(sql) {
  const out = execFileSync('sqlite3', ['-json', DB_FILE, sql], { encoding: 'utf8' }).trim();
  return out ? JSON.parse(out) : [];
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
  `);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });

  if (statusCode === 204) {
    res.end();
    return;
  }

  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function normalizeRecord(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value.trim()]));
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

function splitPath(url) {
  return url.split('?')[0].split('/').filter(Boolean);
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

function listRecords() {
  const rows = allSqlJson(`
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

  const exists = getSqlValue(`SELECT COUNT(*) FROM devices WHERE id = '${escapeSql(id)}';`);
  return Number(exists) > 0 ? { id, ...normalized } : null;
}

async function migrateLegacyJsonIfPresent() {
  try {
    const total = Number(getSqlValue('SELECT COUNT(*) FROM devices;') || '0');
    if (total > 0) {
      return;
    }

    const raw = await fs.readFile(LEGACY_JSON_FILE, 'utf8');
    const legacyRecords = JSON.parse(raw);
    if (!Array.isArray(legacyRecords)) {
      return;
    }

    legacyRecords.forEach((item) => {
      if (isRecordPayloadValid(item)) {
        insertRecord(item, item.id || crypto.randomUUID());
      }
    });
  } catch {
    // ignore missing/invalid legacy file
  }
}

function seedIfEmpty() {
  const total = Number(getSqlValue('SELECT COUNT(*) FROM devices;') || '0');
  if (total > 0) {
    return;
  }

  initialRecords.forEach((item) => insertRecord(item));
}

async function initializeDatabase() {
  initSchema();
  await migrateLegacyJsonIfPresent();
  seedIfEmpty();
}

async function handleApi(req, res) {
  const parts = splitPath(req.url || '');
  if (parts[0] !== 'api' || parts[1] !== 'f-it-01-01-records') {
    return false;
  }

  const recordId = parts[2] || null;

  if (req.method === 'POST' && recordId === 'bulk') {
    const rawBody = await parseBody(req);
    let payload;

    try {
      payload = JSON.parse(rawBody || '[]');
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return true;
    }

    if (!isBulkPayloadValid(payload)) {
      sendJson(res, 400, { error: 'Invalid bulk payload' });
      return true;
    }

    sendJson(res, 201, payload.map((item) => insertRecord(item)));
    return true;
  }

  if (req.method === 'GET' && !recordId) {
    sendJson(res, 200, listRecords());
    return true;
  }

  if (req.method === 'POST' && !recordId) {
    const rawBody = await parseBody(req);
    let payload;

    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return true;
    }

    if (!isRecordPayloadValid(payload)) {
      sendJson(res, 400, { error: 'Invalid record payload' });
      return true;
    }

    sendJson(res, 201, insertRecord(payload));
    return true;
  }

  if (req.method === 'PUT' && recordId) {
    const rawBody = await parseBody(req);
    let payload;

    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return true;
    }

    if (!isRecordPayloadValid(payload)) {
      sendJson(res, 400, { error: 'Invalid record payload' });
      return true;
    }

    const updated = updateRecord(recordId, payload);
    if (!updated) {
      sendJson(res, 404, { error: 'Record not found' });
      return true;
    }

    sendJson(res, 200, updated);
    return true;
  }

  if (req.method === 'DELETE' && recordId) {
    runSql(`DELETE FROM devices WHERE id = '${escapeSql(recordId)}';`);
    const exists = Number(getSqlValue(`SELECT COUNT(*) FROM devices WHERE id = '${escapeSql(recordId)}';`) || '0');
    if (exists > 0) {
      sendJson(res, 500, { error: 'Failed to delete record' });
      return true;
    }

    sendJson(res, 204, {});
    return true;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
  return true;
}

async function handleStatic(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^\/+/, '');
  const filePath = path.join(APP_ROOT, safePath);

  if (!filePath.startsWith(APP_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw new Error('Not a file');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = STATIC_TYPES[ext] || 'application/octet-stream';
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleApi(req, res);
    if (!handled) {
      await handleStatic(req, res);
    }
  } catch {
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

initializeDatabase()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${PORT}`);
      console.log(`SQLite DB: ${DB_FILE}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database', error);
    process.exit(1);
  });
