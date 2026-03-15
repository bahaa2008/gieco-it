const storageKey = 'f-it-01-02-plans-v1';
const form = document.getElementById('maintenancePlanForm');
const tableBody = document.getElementById('maintenancePlanTableBody');

let plans = JSON.parse(localStorage.getItem(storageKey) || '[]');

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(plans));
}

function renderPlans() {
  if (!plans.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-secondary py-4">لا توجد بيانات حالياً.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = plans
    .map(
      (plan) => `
      <tr>
        <td>${plan.deviceName}</td>
        <td>${plan.deviceCode}</td>
        <td>${plan.maintenancePlan}</td>
        <td>${plan.maintenanceDates}</td>
        <td>
          <button class="btn btn-sm btn-outline-danger" type="button" data-id="${plan.id}">حذف</button>
        </td>
      </tr>
    `,
    )
    .join('');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const record = {
    id: crypto.randomUUID(),
    deviceName: document.getElementById('deviceName').value.trim(),
    deviceCode: document.getElementById('deviceCode').value.trim(),
    maintenancePlan: document.getElementById('maintenancePlan').value,
    maintenanceDates: document.getElementById('maintenanceDates').value.trim(),
  };

  plans.unshift(record);
  persist();
  renderPlans();
  form.reset();
});

tableBody.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const id = target.getAttribute('data-id');
  if (!id) {
    return;
  }

  plans = plans.filter((plan) => plan.id !== id);
  persist();
  renderPlans();
});

renderPlans();
