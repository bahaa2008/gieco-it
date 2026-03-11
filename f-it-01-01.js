(() => {
'use strict';

const form = document.getElementById('deviceForm');
const tbody = document.getElementById('devicesTableBody');
const searchInput = document.getElementById('searchInput');
const planFilter = document.getElementById('planFilter');
const userFilter = document.getElementById('userFilter');
const countryFilter = document.getElementById('countryFilter');
const sortField = document.getElementById('sortField');
const sortDirection = document.getElementById('sortDirection');
const clearFiltersButton = document.getElementById('clearFiltersButton');
const submitButton = form.querySelector('button[type="submit"]');
const csvFileInput = document.getElementById('csvFileInput');
const importCsvButton = document.getElementById('importCsvButton');
const formModal = document.getElementById('formModal');
const openFormModalButton = document.getElementById('openFormModalButton');
const closeFormModalButton = document.getElementById('closeFormModalButton');
const filtersModal = document.getElementById('filtersModal');
const openFiltersModalButton = document.getElementById('openFiltersModalButton');
const closeFiltersModalButton = document.getElementById('closeFiltersModalButton');

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

const icons = {
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z"/></svg>',
  edit:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15.15 5.76 3.09 3.09-9.66 9.66H5.5v-3.08l9.65-9.67Zm1.42-1.42 1.67-1.67a1.5 1.5 0 0 1 2.12 0l.97.97a1.5 1.5 0 0 1 0 2.12l-1.67 1.67-3.09-3.09Z"/></svg>',
  delete:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3a1 1 0 0 0-1 1v1H5a1 1 0 1 0 0 2h1v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h1a1 1 0 1 0 0-2h-3V4a1 1 0 0 0-1-1H9Zm1 2h4v1h-4V5Zm-.5 5a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Zm5 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"/></svg>',
};

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

function openFormModal() {
  formModal?.classList.remove('hidden');
}

function closeFormModal() {
  formModal?.classList.add('hidden');
}

function openFiltersModal() {
  filtersModal?.classList.remove('hidden');
}

function closeFiltersModal() {
  filtersModal?.classList.add('hidden');
}

function setSelectOptions(selectElement, values, defaultLabel) {
  if (!selectElement) {
    return;
  }

  const previousValue = selectElement.value;
  const options = [
    `<option value="">${defaultLabel}</option>`,
    ...values.map((value) => `<option value="${value}">${value}</option>`),
  ];

  selectElement.innerHTML = options.join('');
  if (values.includes(previousValue)) {
    selectElement.value = previousValue;
  }
}

function updateDynamicFilters() {
  const users = [...new Set(records.map((record) => record.deviceUser).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ar', { numeric: true, sensitivity: 'base' }),
  );

  const countries = [...new Set(records.map((record) => record.originCountry).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'ar', { numeric: true, sensitivity: 'base' }),
  );

  setSelectOptions(userFilter, users, 'كل المستخدمين');
  setSelectOptions(countryFilter, countries, 'كل الدول');
}

function renderRows() {
  const query = searchInput.value.trim().toLowerCase();
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const plan = planFilter.value;
  const user = userFilter?.value || '';
  const country = countryFilter?.value || '';
  const sortBy = sortField?.value || 'deviceName';
  const direction = sortDirection?.value || 'asc';

  const filtered = records
    .filter((record) => {
      const text = fieldNames.map((field) => record[field]).join(' ').toLowerCase();
      const matchesSearch = queryTokens.every((token) => text.includes(token));
      const matchesPlan = plan === '' || record.maintenancePlan === plan;
      const matchesUser = user === '' || record.deviceUser === user;
      const matchesCountry = country === '' || record.originCountry === country;
      return matchesSearch && matchesPlan && matchesUser && matchesCountry;
    })
    .sort((a, b) => {
      const left = String(a[sortBy] || '');
      const right = String(b[sortBy] || '');
      const result = left.localeCompare(right, 'ar', { numeric: true, sensitivity: 'base' });
      return direction === 'desc' ? -result : result;
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
          <button type="button" class="action-btn action-add" data-action="add" data-id="${record.id}" title="إضافة" aria-label="إضافة">${icons.add}</button>
          <button type="button" class="action-btn action-edit" data-action="edit" data-id="${record.id}" title="تعديل" aria-label="تعديل">${icons.edit}</button>
          <button type="button" class="action-btn action-delete" data-action="delete" data-id="${record.id}" title="حذف" aria-label="حذف">${icons.delete}</button>
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
  updateDynamicFilters();
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

async function bulkCreateRecords(items) {
  const response = await fetch('/api/f-it-01-01-records/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  });

  if (!response.ok) {
    throw new Error('تعذر استيراد ملف CSV.');
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
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function parseCsvRecords(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('ملف CSV لا يحتوي على بيانات كافية.');
  }

  const headerAliases = {
    devicename: 'deviceName',
    'اسمالجهاز': 'deviceName',
    devicecode: 'deviceCode',
    'كودالجهاز': 'deviceCode',
    devicemodel: 'deviceModel',
    'موديلالجهاز': 'deviceModel',
    origincountry: 'originCountry',
    'بلدالمنشأ': 'originCountry',
    serialnumber: 'serialNumber',
    sn: 'serialNumber',
    voltampere: 'voltAmpere',
    'فولتامبير': 'voltAmpere',
    deviceampere: 'deviceAmpere',
    'امبيرالجهاز': 'deviceAmpere',
    deviceuser: 'deviceUser',
    'اسممستخدمالجهاز': 'deviceUser',
    maintenanceplan: 'maintenancePlan',
    'المخططالزمنيللصيانةالدورية': 'maintenancePlan',
  };

  const rawHeaders = parseCsvRow(lines[0]).map(normalizeHeader);
  const mappedHeaders = rawHeaders.map((header) => headerAliases[header] || null);

  if (mappedHeaders.some((item) => item === null)) {
    throw new Error('عناوين CSV غير معروفة. استخدم أسماء الحقول المعتمدة.');
  }

  const missingFields = fieldNames.filter((field) => !mappedHeaders.includes(field));
  if (missingFields.length > 0) {
    throw new Error('ملف CSV ينقصه بعض الأعمدة المطلوبة.');
  }

  return lines.slice(1).map((line) => {
    const cells = parseCsvRow(line);
    const record = {};

    mappedHeaders.forEach((field, index) => {
      record[field] = (cells[index] || '').trim();
    });

    return record;
  });
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

    updateDynamicFilters();
    renderRows();
    closeFormModal();
  } catch (error) {
    alert(error.message);
  }
});

importCsvButton?.addEventListener('click', async () => {
  const file = csvFileInput?.files?.[0];
  if (!file) {
    alert('اختر ملف CSV أولاً.');
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseCsvRecords(text);
    const created = await bulkCreateRecords(parsed);
    records = [...created, ...records];
    updateDynamicFilters();
    renderRows();
    csvFileInput.value = '';
    alert(`تم استيراد ${created.length} سجل بنجاح.`);
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
    openFormModal();
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
      updateDynamicFilters();
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
      updateDynamicFilters();
      renderRows();
    } catch (error) {
      alert(error.message);
    }
  }
});

searchInput.addEventListener('input', renderRows);
planFilter.addEventListener('change', renderRows);
userFilter?.addEventListener('change', renderRows);
countryFilter?.addEventListener('change', renderRows);
sortField?.addEventListener('change', renderRows);
sortDirection?.addEventListener('change', renderRows);

clearFiltersButton?.addEventListener('click', () => {
  searchInput.value = '';
  planFilter.value = '';
  if (userFilter) userFilter.value = '';
  if (countryFilter) countryFilter.value = '';
  if (sortField) sortField.value = 'deviceName';
  if (sortDirection) sortDirection.value = 'asc';
  renderRows();
});


openFormModalButton?.addEventListener('click', () => {
  resetFormState();
  openFormModal();
});

closeFormModalButton?.addEventListener('click', () => {
  closeFormModal();
});

formModal?.addEventListener('click', (event) => {
  if (event.target === formModal) {
    closeFormModal();
  }
});

openFiltersModalButton?.addEventListener('click', () => {
  openFiltersModal();
});

closeFiltersModalButton?.addEventListener('click', () => {
  closeFiltersModal();
});

filtersModal?.addEventListener('click', (event) => {
  if (event.target === filtersModal) {
    closeFiltersModal();
  }
});

loadRecords().catch(() => {
  tbody.innerHTML = '<tr><td colspan="10">تعذر تحميل البيانات من الخادم.</td></tr>';
});

})();
