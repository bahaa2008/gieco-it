const form = document.getElementById('deviceForm');
const tbody = document.getElementById('devicesTableBody');
const searchInput = document.getElementById('searchInput');
const planFilter = document.getElementById('planFilter');

let records = [];

function renderRows() {
  const query = searchInput.value.trim().toLowerCase();
  const plan = planFilter.value;

  const filtered = records.filter((record) => {
    const text = Object.values(record).join(' ').toLowerCase();
    const matchesSearch = query === '' || text.includes(query);
    const matchesPlan = plan === '' || record.maintenancePlan === plan;
    return matchesSearch && matchesPlan;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10">لا توجد بيانات مطابقة.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (record) => `
      <tr>
        <td>${record.deviceName}</td>
        <td>${record.deviceCode}</td>
        <td>${record.deviceModel}</td>
        <td>${record.originCountry}</td>
        <td>${record.serialNumber}</td>
        <td>${record.voltAmpere}</td>
        <td>${record.deviceAmpere}</td>
        <td>${record.deviceUser}</td>
        <td>${record.maintenancePlan}</td>
        <td></td>
      </tr>
    `,
    )
    .join('');
}

async function loadRecords() {
  const response = await fetch('/api/f-it-01-01-records');
  if (!response.ok) {
    throw new Error('Failed to load records');
  }

  const data = await response.json();
  records = Array.isArray(data) ? data : [];
  renderRows();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);

  const newRecord = {
    deviceName: formData.get('deviceName').toString().trim(),
    deviceCode: formData.get('deviceCode').toString().trim(),
    deviceModel: formData.get('deviceModel').toString().trim(),
    originCountry: formData.get('originCountry').toString().trim(),
    serialNumber: formData.get('serialNumber').toString().trim(),
    voltAmpere: formData.get('voltAmpere').toString().trim(),
    deviceAmpere: formData.get('deviceAmpere').toString().trim(),
    deviceUser: formData.get('deviceUser').toString().trim(),
    maintenancePlan: formData.get('maintenancePlan').toString().trim(),
  };

  const response = await fetch('/api/f-it-01-01-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRecord),
  });

  if (!response.ok) {
    alert('تعذر حفظ السجل.');
    return;
  }

  const savedRecord = await response.json();
  records.unshift(savedRecord);
  form.reset();
  renderRows();
});

searchInput.addEventListener('input', renderRows);
planFilter.addEventListener('change', renderRows);

loadRecords().catch(() => {
  tbody.innerHTML = '<tr><td colspan="10">تعذر تحميل البيانات من الخادم.</td></tr>';
});
