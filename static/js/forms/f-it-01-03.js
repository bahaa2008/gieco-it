(() => {
'use strict';

const workOrderTableBody = document.getElementById('workOrderTableBody');

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

const SEARCH_FIELDS = ['deviceName', 'deviceCode', 'maintenancePlan', 'date'];

let rows = [];
let currentPage = 1;
let pageSize = Number(pageSizeSelect?.value || 50);

function getRequestedDeviceId() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get('deviceId') || '').trim();
}

function openFiltersModal() {
  filtersModal?.classList.remove('hidden');
}

function closeFiltersModal() {
  filtersModal?.classList.add('hidden');
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

function getFilteredSortedRows() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const selectedPlan = planFilter?.value || '';
  const selectedSortField = sortField?.value || 'deviceName';
  const selectedSortDirection = sortDirection?.value || 'asc';

  return rows
    .filter((row) => {
      const searchable = SEARCH_FIELDS.map((field) => row[field] || '').join(' ').toLowerCase();
      const matchesSearch = queryTokens.every((token) => searchable.includes(token));
      const matchesPlan = selectedPlan === '' || row.maintenancePlan === selectedPlan;
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
  const filtered = getFilteredSortedRows();
  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  if (totalPages > 0 && currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize;
  return {
    totalItems,
    totalPages,
    pageItems: filtered.slice(startIndex, startIndex + pageSize),
  };
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
    renderEmptyState();
    renderPagination(totalItems, totalPages);
    return;
  }

  workOrderTableBody.innerHTML = pageItems
    .map(
      (row, index) => `
      <tr>
        <td>${(currentPage - 1) * pageSize + index + 1}</td>
        <td>${row.deviceName}</td>
        <td>${row.deviceCode}</td>
        <td>${row.maintenancePlan}</td>
        <td>${row.date}</td>
      </tr>
    `,
    )
    .join('');

  renderPagination(totalItems, totalPages);
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
    if (searchInput) {
      searchInput.value = '';
    }
    if (planFilter) {
      planFilter.value = '';
    }
    if (sortField) {
      sortField.value = 'deviceName';
    }
    if (sortDirection) {
      sortDirection.value = 'asc';
    }
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
    const totalItems = getFilteredSortedRows().length;
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
}

async function init() {
  bindEvents();

  try {
    const workOrders = await loadWorkOrders();
    rows = flattenRows(workOrders);
    renderRows();
  } catch (error) {
    workOrderTableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    renderPagination(0, 0);
  }
}

init();
})();
