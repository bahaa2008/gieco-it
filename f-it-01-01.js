const form = document.getElementById('deviceForm');
const tbody = document.getElementById('devicesTableBody');
const searchInput = document.getElementById('searchInput');
const planFilter = document.getElementById('planFilter');
const submitButton = form.querySelector('button[type="submit"]');

const fieldNames = [
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

let records = [];
let editingRecordId = null;

function getFormRecord() {
  const formData = new FormData(form);

  return {
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
}

function setFormRecord(record) {
  fieldNames.forEach((name) => {
    const element = form.elements.namedItem(name);
    if (element) {
      element.value = record[name] || '';
    }
  });
}

function resetFormState() {
  editingRecordId = null;
  form.reset();
  submitButton.textContent = 'إضافة';
}

function renderRows() {
  const query = searchInput.value.trim().toLowerCase();
  const plan = planFilter.value;

  const filtered = records.filter((record) => {
    const text = fieldNames.map((field) => record[field]).join(' ').toLowerCase();
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
        <td class="row-actions">
          <button type="button" class="action-btn action-add" data-action="add" data-id="${record.id}" title="إضافة" aria-label="إضافة">➕</button>
          <button type="button" class="action-btn action-edit" data-action="edit" data-id="${record.id}" title="تعديل" aria-label="تعديل">✏️</button>
          <button type="button" class="action-btn action-delete" data-action="delete" data-id="${record.id}" title="حذف" aria-label="حذف">🗑️</button>
        </td>
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

async function createRecord(record) {
  const response = await fetch('/api/f-it-01-01-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error('تعذر حفظ السجل.');
  }

  return response.json();
}

async function updateRecord(id, record) {
  const response = await fetch(`/api/f-it-01-01-records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });

  if (!response.ok) {
    throw new Error('تعذر تعديل السجل.');
  }

  return response.json();
}

async function deleteRecord(id) {
  const response = await fetch(`/api/f-it-01-01-records/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('تعذر حذف السجل.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const payload = getFormRecord();

    if (editingRecordId) {
      const updated = await updateRecord(editingRecordId, payload);
      records = records.map((record) => (record.id === updated.id ? updated : record));
      resetFormState();
    } else {
      const saved = await createRecord(payload);
      records.unshift(saved);
      form.reset();
    }

    renderRows();
  } catch (error) {
    alert(error.message);
  }
});

tbody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const action = button.dataset.action;
  const record = records.find((item) => item.id === id);

  if (!record) {
    return;
  }

  if (action === 'edit') {
    editingRecordId = id;
    setFormRecord(record);
    submitButton.textContent = 'حفظ التعديل';
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm('هل تريد حذف هذا السجل؟');
    if (!confirmed) {
      return;
    }

    try {
      await deleteRecord(id);
      records = records.filter((item) => item.id !== id);
      if (editingRecordId === id) {
        resetFormState();
      }
      renderRows();
    } catch (error) {
      alert(error.message);
    }

    return;
  }

  if (action === 'add') {
    try {
      const copyPayload = Object.fromEntries(fieldNames.map((field) => [field, record[field] || '']));
      const saved = await createRecord(copyPayload);
      records.unshift(saved);
      renderRows();
    } catch (error) {
      alert(error.message);
    }
  }
});

searchInput.addEventListener('input', renderRows);
planFilter.addEventListener('change', renderRows);

loadRecords().catch(() => {
  tbody.innerHTML = '<tr><td colspan="10">تعذر تحميل البيانات من الخادم.</td></tr>';
});
