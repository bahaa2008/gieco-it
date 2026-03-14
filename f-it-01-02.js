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

const STORAGE_KEY = 'f-it-01-02-date-range';
const SEARCH_FIELDS = ['deviceName', 'deviceCode', 'maintenancePlan'];

let records = [];
let currentPage = 1;
let pageSize = Number(pageSizeSelect?.value || 50);
let dateRange = buildDefaultDateRange();

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
  const filtered = getFilteredSortedRecords();
  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  if (totalPages > 0 && currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  if (pageItems.length === 0) {
    scheduleTableBody.innerHTML = '<tr><td colspan="4">لا توجد بيانات مطابقة.</td></tr>';
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
          <td>${record.deviceName}</td>
          <td>${record.deviceCode}</td>
          <td>${record.maintenancePlan}</td>
          <td>${datesMarkup}</td>
        </tr>
      `;
    })
    .join('');

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
        deviceName: String(record.deviceName || '').trim(),
        deviceCode: String(record.deviceCode || '').trim(),
        maintenancePlan: String(record.maintenancePlan || '').trim(),
      }))
    : [];
  renderRows();
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
  dateSettingsForm?.addEventListener('submit', handleDateSettingsSubmit);
}

async function init() {
  loadDateRange();
  bindEvents();

  try {
    await loadRecords();
  } catch (error) {
    scheduleTableBody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    renderPagination(0, 0);
  }
}

init();
})();
