(() => {
'use strict';

const scheduleTableBody = document.getElementById('scheduleTableBody');
const searchInput = document.getElementById('searchInput');
const planFilter = document.getElementById('planFilter');
const sortField = document.getElementById('sortField');
const sortDirection = document.getElementById('sortDirection');
const clearFiltersButton = document.getElementById('clearFiltersButton');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageIndicator = document.getElementById('pageIndicator');
const paginationInfo = document.getElementById('paginationInfo');

const filtersModal = document.getElementById('filtersModal');
const openFiltersModalButton = document.getElementById('openFiltersModalButton');
const closeFiltersModalButton = document.getElementById('closeFiltersModalButton');

const dateSettingsModal = document.getElementById('dateSettingsModal');
const openDateSettingsModalButton = document.getElementById('openDateSettingsModalButton');
const closeDateSettingsModalButton = document.getElementById('closeDateSettingsModalButton');
const dateSettingsForm = document.getElementById('dateSettingsForm');
const scheduleStartDateInput = document.getElementById('scheduleStartDate');
const scheduleEndDateInput = document.getElementById('scheduleEndDate');

const workOrderModal = document.getElementById('workOrderModal');
const closeWorkOrderModalButton = document.getElementById('closeWorkOrderModalButton');
const workOrderForm = document.getElementById('workOrderForm');
const workOrderDeviceName = document.getElementById('workOrderDeviceName');
const workOrderDeviceCode = document.getElementById('workOrderDeviceCode');
const workOrderPlan = document.getElementById('workOrderPlan');
const customWorkOrderDate = document.getElementById('customWorkOrderDate');
const workOrderDateOptions = document.getElementById('workOrderDateOptions');

const bulkGenerateButton = document.getElementById('bulkGenerateWorkOrdersButton');
const selectAllRowsCheckbox = document.getElementById('selectAllRowsCheckbox');

const STORAGE_KEY = 'f-it-01-02-date-range';
const SEARCH_FIELDS = ['deviceName', 'deviceCode', 'maintenancePlan'];

const icons = {
  workOrder:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z"/></svg>',
};

let records = [];
let currentPage = 1;
let pageSize = Number(pageSizeSelect?.value || 50);
let dateRange = buildDefaultDateRange();
let selectedWorkOrderRecord = null;
let workOrderDeviceIds = new Set();
let selectedRecordIds = new Set();

function buildDefaultDateRange() {
  const now = new Date();
  const year = now.getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function toDate(value) {
  const date = new Date(`${String(value).trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
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

function resolveIntervalMonths(rate) {
  const map = {
    'شهري': 1,
    'كل شهرين': 2,
    'ربع سنوي': 3,
    'نصف سنوي': 6,
    'سنوي': 12,
  };

  return map[String(rate || '').trim()] || null;
}

function calculateMaintenanceDates(rate, startDateRaw, endDateRaw) {
  const startDate = toDate(startDateRaw);
  const endDate = toDate(endDateRaw);
  const intervalMonths = resolveIntervalMonths(rate);

  if (!startDate || !endDate || !intervalMonths || startDate > endDate) {
    return [];
  }

  const dates = [];
  let cursor = startDate;

  while (cursor <= endDate) {
    dates.push(formatDate(cursor));
    cursor = addMonthsToDate(cursor, intervalMonths);
  }

  return dates;
}

function openFiltersModal() {
  filtersModal?.classList.remove('hidden');
}

function closeFiltersModal() {
  filtersModal?.classList.add('hidden');
}

function openDateSettingsModal() {
  scheduleStartDateInput.value = dateRange.startDate;
  scheduleEndDateInput.value = dateRange.endDate;
  dateSettingsModal?.classList.remove('hidden');
}

function closeDateSettingsModal() {
  dateSettingsModal?.classList.add('hidden');
}

function openWorkOrderModal(record) {
  selectedWorkOrderRecord = record;
  workOrderDeviceName.value = `اسم الجهاز: ${record.deviceName}`;
  workOrderDeviceCode.value = `كود الجهاز: ${record.deviceCode}`;
  workOrderPlan.value = `المخطط: ${record.maintenancePlan}`;
  customWorkOrderDate.value = '';

  const dates = calculateMaintenanceDates(record.maintenancePlan, dateRange.startDate, dateRange.endDate);
  workOrderDateOptions.innerHTML = dates.length
    ? dates
        .map(
          (date) =>
            `<label><input type="checkbox" class="work-order-date-option" value="${date}" checked /> ${date}</label>`,
        )
        .join('')
    : '<span class="text-secondary">لا توجد تواريخ صيانة ضمن النطاق الحالي.</span>';

  workOrderModal?.classList.remove('hidden');
}

function closeWorkOrderModal() {
  selectedWorkOrderRecord = null;
  workOrderModal?.classList.add('hidden');
}

function persistDateRange() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dateRange));
}

function loadDateRange() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed?.startDate && parsed?.endDate) {
      dateRange = {
        startDate: String(parsed.startDate),
        endDate: String(parsed.endDate),
      };
    }
  } catch {
    dateRange = buildDefaultDateRange();
  }
}

function getFilteredSortedRecords() {
  const query = searchInput.value.trim().toLowerCase();
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const selectedPlan = planFilter.value;
  const selectedSortField = sortField.value || 'deviceName';
  const selectedSortDirection = sortDirection.value || 'asc';

  return records
    .filter((record) => {
      const searchable = SEARCH_FIELDS.map((field) => record[field] || '').join(' ').toLowerCase();
      const matchesSearch = queryTokens.every((token) => searchable.includes(token));
      const matchesPlan = selectedPlan === '' || record.maintenancePlan === selectedPlan;
      return matchesSearch && matchesPlan;
    })
    .sort((a, b) => {
      const left = String(a[selectedSortField] || '');
      const right = String(b[selectedSortField] || '');
      const result = left.localeCompare(right, 'ar', { numeric: true, sensitivity: 'base' });
      return selectedSortDirection === 'desc' ? -result : result;
    });
}

function getCurrentPageItems() {
  const filtered = getFilteredSortedRecords();
  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  if (totalPages > 0 && currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize;
  return {
    filtered,
    totalItems,
    totalPages,
    pageItems: filtered.slice(startIndex, startIndex + pageSize),
  };
}

function syncSelectAllCheckbox(pageItems) {
  if (!selectAllRowsCheckbox) {
    return;
  }

  if (pageItems.length === 0) {
    selectAllRowsCheckbox.checked = false;
    selectAllRowsCheckbox.indeterminate = false;
    return;
  }

  const selectedCount = pageItems.filter((item) => selectedRecordIds.has(item.id)).length;
  selectAllRowsCheckbox.checked = selectedCount === pageItems.length;
  selectAllRowsCheckbox.indeterminate = selectedCount > 0 && selectedCount < pageItems.length;
}

function updateBulkButtonState() {
  if (bulkGenerateButton) {
    bulkGenerateButton.disabled = selectedRecordIds.size === 0;
  }
}

function renderPagination(totalItems, totalPages) {
  if (paginationInfo) {
    paginationInfo.textContent = `النتائج: ${totalItems}`;
  }
  if (pageIndicator) {
    pageIndicator.textContent = `صفحة ${totalPages === 0 ? 0 : currentPage} من ${totalPages}`;
  }
  if (prevPageButton) {
    prevPageButton.disabled = currentPage <= 1;
  }
  if (nextPageButton) {
    nextPageButton.disabled = currentPage >= totalPages;
  }
}

function renderRows() {
  const { totalItems, totalPages, pageItems } = getCurrentPageItems();

  if (pageItems.length === 0) {
    scheduleTableBody.innerHTML = '<tr><td colspan="7">لا توجد بيانات مطابقة.</td></tr>';
    syncSelectAllCheckbox([]);
    updateBulkButtonState();
    renderPagination(totalItems, totalPages);
    return;
  }

  scheduleTableBody.innerHTML = pageItems
    .map((record) => {
      const dates = calculateMaintenanceDates(record.maintenancePlan, dateRange.startDate, dateRange.endDate);
      const datesMarkup =
        dates.length > 0
          ? `<ul class="mb-0">${dates.map((date) => `<li>${date}</li>`).join('')}</ul>`
          : '<span class="text-secondary">لا توجد تواريخ ضمن النطاق</span>';

      return `
        <tr>
          <td class="text-center"><input type="checkbox" class="row-select-checkbox" data-id="${record.id}" ${
        selectedRecordIds.has(record.id) ? 'checked' : ''
      } aria-label="تحديد الجهاز" /></td>
          <td>${record.deviceName}</td>
          <td>${record.deviceCode}</td>
          <td>${record.maintenancePlan}</td>
          <td>${datesMarkup}</td>
          <td class="text-center">
            <input type="checkbox" ${workOrderDeviceIds.has(record.id) ? 'checked' : ''} disabled aria-label="حالة التنفيذ" />
          </td>
          <td class="row-actions">
            <button type="button" class="action-btn action-add" data-action="generate-work-order" data-id="${record.id}" title="إنشاء أمر شغل" aria-label="إنشاء أمر شغل">${icons.workOrder}</button>
          </td>
        </tr>
      `;
    })
    .join('');

  syncSelectAllCheckbox(pageItems);
  updateBulkButtonState();
  renderPagination(totalItems, totalPages);
}

async function loadRecords() {
  const response = await fetch('/api/f-it-01-01-records');
  if (!response.ok) {
    throw new Error('تعذر تحميل البيانات.');
  }

  const data = await response.json();
  records = Array.isArray(data)
    ? data.map((record) => ({
        id: String(record.id || ''),
        deviceName: String(record.deviceName || '').trim(),
        deviceCode: String(record.deviceCode || '').trim(),
        maintenancePlan: String(record.maintenancePlan || '').trim(),
      }))
    : [];
}

async function loadWorkOrderStatuses() {
  const response = await fetch('/api/f-it-01-03-work-orders');
  if (!response.ok) {
    throw new Error('تعذر تحميل حالة أوامر الشغل.');
  }

  const data = await response.json();
  const items = Array.isArray(data) ? data : [];
  workOrderDeviceIds = new Set(items.map((item) => String(item?.deviceId || '').trim()).filter(Boolean));
}

function handleDateSettingsSubmit(event) {
  event.preventDefault();

  const startDate = scheduleStartDateInput.value;
  const endDate = scheduleEndDateInput.value;

  if (!toDate(startDate) || !toDate(endDate)) {
    alert('يرجى إدخال تاريخ بداية ونهاية صالحين.');
    return;
  }

  if (toDate(startDate) > toDate(endDate)) {
    alert('تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.');
    return;
  }

  dateRange = { startDate, endDate };
  persistDateRange();
  closeDateSettingsModal();
  renderRows();
}

function getSelectedWorkOrderDates() {
  const selectedDates = Array.from(document.querySelectorAll('.work-order-date-option:checked')).map(
    (checkbox) => checkbox.value,
  );

  const manualDate = String(customWorkOrderDate.value || '').trim();
  if (manualDate) {
    selectedDates.push(manualDate);
  }

  return [...new Set(selectedDates)].sort();
}

function buildWorkOrderPayload(record, dates) {
  return {
    deviceId: record.id,
    deviceName: record.deviceName,
    deviceCode: record.deviceCode,
    maintenancePlan: record.maintenancePlan,
    dates,
  };
}

async function saveWorkOrder(payload) {
  const response = await fetch('/api/f-it-01-03-work-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('تعذر إنشاء أمر الشغل.');
  }

  return response.json();
}

async function handleWorkOrderSubmit(event) {
  event.preventDefault();

  if (!selectedWorkOrderRecord) {
    return;
  }

  const dates = getSelectedWorkOrderDates();
  if (dates.length === 0) {
    alert('اختر تاريخًا واحدًا على الأقل أو أضف تاريخًا مخصصًا.');
    return;
  }

  const payload = buildWorkOrderPayload(selectedWorkOrderRecord, dates);

  try {
    await saveWorkOrder(payload);
    workOrderDeviceIds.add(payload.deviceId);
    renderRows();
    closeWorkOrderModal();
    const params = new URLSearchParams({ deviceId: payload.deviceId });
    window.location.href = `../f-it-01-03/index.html?${params.toString()}`;
  } catch (error) {
    alert(error.message || 'حدث خطأ أثناء إنشاء أمر الشغل.');
  }
}

async function handleBulkGenerateWorkOrders() {
  const selectedRecords = records.filter((record) => selectedRecordIds.has(record.id));
  if (selectedRecords.length === 0) {
    alert('اختر جهازًا واحدًا على الأقل.');
    return;
  }

  let success = 0;
  for (const record of selectedRecords) {
    const dates = calculateMaintenanceDates(record.maintenancePlan, dateRange.startDate, dateRange.endDate);
    if (dates.length === 0) {
      continue;
    }

    const payload = buildWorkOrderPayload(record, dates);
    try {
      await saveWorkOrder(payload);
      workOrderDeviceIds.add(record.id);
      success += 1;
    } catch {
      // Continue bulk processing for other records.
    }
  }

  renderRows();
  alert(`تم إنشاء/تحديث أوامر شغل لعدد ${success} جهاز.`);
}

function bindEvents() {
  [searchInput, planFilter, sortField, sortDirection].forEach((element) => {
    element?.addEventListener('input', () => {
      currentPage = 1;
      renderRows();
    });
    element?.addEventListener('change', () => {
      currentPage = 1;
      renderRows();
    });
  });

  clearFiltersButton?.addEventListener('click', () => {
    searchInput.value = '';
    planFilter.value = '';
    sortField.value = 'deviceName';
    sortDirection.value = 'asc';
    currentPage = 1;
    renderRows();
  });

  pageSizeSelect?.addEventListener('change', () => {
    pageSize = Number(pageSizeSelect.value || 50);
    currentPage = 1;
    renderRows();
  });

  prevPageButton?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage -= 1;
      renderRows();
    }
  });

  nextPageButton?.addEventListener('click', () => {
    const totalItems = getFilteredSortedRecords().length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    if (currentPage < totalPages) {
      currentPage += 1;
      renderRows();
    }
  });

  selectAllRowsCheckbox?.addEventListener('change', () => {
    const { pageItems } = getCurrentPageItems();
    pageItems.forEach((record) => {
      if (selectAllRowsCheckbox.checked) {
        selectedRecordIds.add(record.id);
      } else {
        selectedRecordIds.delete(record.id);
      }
    });
    renderRows();
  });

  bulkGenerateButton?.addEventListener('click', handleBulkGenerateWorkOrders);

  scheduleTableBody?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.row-select-checkbox');
    if (!checkbox) {
      return;
    }

    const id = String(checkbox.dataset.id || '');
    if (checkbox.checked) {
      selectedRecordIds.add(id);
    } else {
      selectedRecordIds.delete(id);
    }
    renderRows();
  });

  scheduleTableBody?.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action="generate-work-order"]');
    if (!actionButton) {
      return;
    }

    const record = records.find((item) => item.id === String(actionButton.dataset.id || ''));
    if (record) {
      openWorkOrderModal(record);
    }
  });

  openFiltersModalButton?.addEventListener('click', openFiltersModal);
  closeFiltersModalButton?.addEventListener('click', closeFiltersModal);
  filtersModal?.addEventListener('click', (event) => {
    if (event.target === filtersModal) {
      closeFiltersModal();
    }
  });

  openDateSettingsModalButton?.addEventListener('click', openDateSettingsModal);
  closeDateSettingsModalButton?.addEventListener('click', closeDateSettingsModal);
  dateSettingsModal?.addEventListener('click', (event) => {
    if (event.target === dateSettingsModal) {
      closeDateSettingsModal();
    }
  });

  closeWorkOrderModalButton?.addEventListener('click', closeWorkOrderModal);
  workOrderModal?.addEventListener('click', (event) => {
    if (event.target === workOrderModal) {
      closeWorkOrderModal();
    }
  });

  dateSettingsForm?.addEventListener('submit', handleDateSettingsSubmit);
  workOrderForm?.addEventListener('submit', handleWorkOrderSubmit);
}

async function init() {
  loadDateRange();
  bindEvents();

  try {
    await Promise.all([loadRecords(), loadWorkOrderStatuses()]);
    renderRows();
  } catch (error) {
    scheduleTableBody.innerHTML = `<tr><td colspan="7">${error.message}</td></tr>`;
    renderPagination(0, 0);
  }
}

init();
})();
