(() => {
'use strict';

const workOrderTableBody = document.getElementById('workOrderTableBody');

function getRequestedDeviceId() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('deviceId') || '').trim();
}

function renderEmptyState() {
  workOrderTableBody.innerHTML = '<tr><td colspan="5">لا توجد بيانات أمر شغل. قم بإنشائه من F-IT-01-02.</td></tr>';
}

function flattenRows(workOrders) {
  return workOrders.flatMap((item) => {
    const dates = Array.isArray(item?.dates) ? item.dates : [];
    return dates.map((date) => ({
      deviceName: String(item.deviceName || ''),
      deviceCode: String(item.deviceCode || ''),
      maintenancePlan: String(item.maintenancePlan || ''),
      date: String(date || ''),
      updatedAt: String(item.updatedAt || ''),
    }));
  });
}

function renderRows(workOrders) {
  const rows = flattenRows(workOrders);

  if (rows.length === 0) {
    renderEmptyState();
    return;
  }

  workOrderTableBody.innerHTML = rows
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${row.deviceName}</td>
        <td>${row.deviceCode}</td>
        <td>${row.maintenancePlan}</td>
        <td>${row.date}</td>
      </tr>
    `,
    )
    .join('');
}

async function loadWorkOrders() {
  const deviceId = getRequestedDeviceId();
  const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
  const response = await fetch(`/api/f-it-01-03-work-orders${query}`);

  if (!response.ok) {
    throw new Error('تعذر تحميل أوامر الشغل.');
  }

  const payload = await response.json();
  if (!payload) {
    return [];
  }

  return Array.isArray(payload) ? payload : [payload];
}

async function init() {
  try {
    const workOrders = await loadWorkOrders();
    renderRows(workOrders);
  } catch (error) {
    workOrderTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
  }
}

init();
})();
