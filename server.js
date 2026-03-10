const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const APP_ROOT = __dirname;
const DATA_DIR = path.join(APP_ROOT, 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'f-it-01-01-records.json');

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

async function ensureRecordsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(RECORDS_FILE);
  } catch {
    await fs.writeFile(RECORDS_FILE, JSON.stringify(initialRecords, null, 2), 'utf8');
  }
}

async function readRecords() {
  await ensureRecordsFile();
  const data = await fs.readFile(RECORDS_FILE, 'utf8');
  const records = JSON.parse(data);
  return Array.isArray(records) ? records : [];
}

async function writeRecords(records) {
  await fs.writeFile(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
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

function isRecordValid(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }

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

  return requiredFields.every((field) => typeof record[field] === 'string');
}

async function handleApi(req, res) {
  if (req.url !== '/api/f-it-01-01-records') {
    return false;
  }

  if (req.method === 'GET') {
    const records = await readRecords();
    sendJson(res, 200, records);
    return true;
  }

  if (req.method === 'POST') {
    const rawBody = await parseBody(req);
    let record;

    try {
      record = JSON.parse(rawBody || '{}');
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' });
      return true;
    }

    if (!isRecordValid(record)) {
      sendJson(res, 400, { error: 'Invalid record payload' });
      return true;
    }

    const normalizedRecord = Object.fromEntries(
      Object.entries(record).map(([key, value]) => [key, value.trim()]),
    );

    const records = await readRecords();
    records.unshift(normalizedRecord);
    await writeRecords(records);

    sendJson(res, 201, normalizedRecord);
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
  } catch (error) {
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

ensureRecordsFile()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Server running at http://${HOST}:${PORT}`);
      console.log(`Data file: ${RECORDS_FILE}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data file', error);
    process.exit(1);
  });
