(() => {
'use strict';

const WORK_ORDER_STORAGE_KEY = 'f-it-01-03-work-orders';
const workOrderTableBody = document.getElementById('workOrderTableBody');

function parseQueryPayload() {
  const params = new URLSearchParams(window.location.search);
  const dates = String(params.get('dates') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (dates.length === 0) {
    return null;
  }

  return {
    deviceName: String(params.get('deviceName') || '').trim(),
    deviceCode: String(params.get('deviceCode') || '').trim(),
    maintenancePlan: String(params.get('maintenancePlan') || '').trim(),
    dates,
  };
}

function parseStoragePayload() {
  try {
    const raw = localStorage.getItem(WORK_ORDER_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.dates) || parsed.dates.length === 0) {
      return null;
    }

    return {
      deviceName: String(parsed.deviceName || '').trim(),
      deviceCode: String(parsed.deviceCode || '').trim(),
      maintenancePlan: String(parsed.maintenancePlan || '').trim(),
      dates: parsed.dates.map((item) => String(item).trim()).filter(Boolean),
    };
  } catch {
    return null;
  }
}

function renderEmptyState() {
  workOrderTableBody.innerHTML = '<tr><td colspan="5">لا توجد بيانات أمر شغل. قم بإنشائه من F-IT-01-02.</td></tr>';
}

function render(payload) {
  if (!payload || !payload.dates || payload.dates.length === 0) {
    renderEmptyState();
    return;
  }

  workOrderTableBody.innerHTML = payload.dates
    .map(
      (date, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${payload.deviceName}</td>
        <td>${payload.deviceCode}</td>
        <td>${payload.maintenancePlan}</td>
        <td>${date}</td>
      </tr>
    `,
    )
    .join('');
}

function init() {
  const payload = parseQueryPayload() || parseStoragePayload();
  render(payload);
}

init();
})();
