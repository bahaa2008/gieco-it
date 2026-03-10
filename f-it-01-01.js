const initialRecords = [
  {
    id: crypto.randomUUID(),
    deviceName: "حاسب مكتبي - الإدارة",
    deviceCode: "PC-001",
    deviceModel: "OptiPlex 7000",
    originCountry: "الصين",
    serialNumber: "SN-4451",
    voltAmpere: "220V",
    deviceAmpere: "3A",
    deviceUser: "قسم تقنية المعلومات",
    maintenancePlan: "ربع سنوي",
  },
  {
    id: crypto.randomUUID(),
    deviceName: "حاسب محمول - المبيعات",
    deviceCode: "LAP-014",
    deviceModel: "Latitude 5520",
    originCountry: "ماليزيا",
    serialNumber: "SN-8942",
    voltAmpere: "220V",
    deviceAmpere: "2A",
    deviceUser: "فريق المبيعات",
    maintenancePlan: "نصف سنوي",
  },
];

const storageKey = "f-it-01-01-records-v1";
const form = document.getElementById("deviceForm");
const tbody = document.getElementById("devicesTableBody");
const searchInput = document.getElementById("searchInput");
const planFilter = document.getElementById("planFilter");
const submitButton = document.getElementById("submitButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const bulkImportInput = document.getElementById("bulkImportInput");
const bulkImportButton = document.getElementById("bulkImportButton");

const fieldNames = [
  "deviceName",
  "deviceCode",
  "deviceModel",
  "originCountry",
  "serialNumber",
  "voltAmpere",
  "deviceAmpere",
  "deviceUser",
  "maintenancePlan",
];

let records = JSON.parse(localStorage.getItem(storageKey) || "null") || [...initialRecords];
let editingId = null;

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(records));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toRecordFromFormData(formData) {
  return {
    deviceName: formData.get("deviceName").toString().trim(),
    deviceCode: formData.get("deviceCode").toString().trim(),
    deviceModel: formData.get("deviceModel").toString().trim(),
    originCountry: formData.get("originCountry").toString().trim(),
    serialNumber: formData.get("serialNumber").toString().trim(),
    voltAmpere: formData.get("voltAmpere").toString().trim(),
    deviceAmpere: formData.get("deviceAmpere").toString().trim(),
    deviceUser: formData.get("deviceUser").toString().trim(),
    maintenancePlan: formData.get("maintenancePlan").toString().trim(),
  };
}

function resetEditMode() {
  editingId = null;
  submitButton.textContent = "إضافة";
  cancelEditButton.hidden = true;
  form.reset();
}

function fillForm(record) {
  fieldNames.forEach((field) => {
    const input = form.elements.namedItem(field);
    if (input) {
      input.value = record[field] || "";
    }
  });
}

function renderRows() {
  const query = searchInput.value.trim().toLowerCase();
  const plan = planFilter.value;

  const filtered = records.filter((record) => {
    const text = fieldNames.map((f) => record[f] || "").join(" ").toLowerCase();
    const matchesSearch = query === "" || text.includes(query);
    const matchesPlan = plan === "" || record.maintenancePlan === plan;
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
        <td>${escapeHtml(record.deviceName)}</td>
        <td>${escapeHtml(record.deviceCode)}</td>
        <td>${escapeHtml(record.deviceModel)}</td>
        <td>${escapeHtml(record.originCountry)}</td>
        <td>${escapeHtml(record.serialNumber)}</td>
        <td>${escapeHtml(record.voltAmpere)}</td>
        <td>${escapeHtml(record.deviceAmpere)}</td>
        <td>${escapeHtml(record.deviceUser)}</td>
        <td>${escapeHtml(record.maintenancePlan)}</td>
        <td class="actions-cell">
          <button class="table-action" data-action="edit" data-id="${record.id}">تعديل</button>
          <button class="table-action danger" data-action="delete" data-id="${record.id}">حذف</button>
        </td>
      </tr>
    `,
    )
    .join("");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const values = toRecordFromFormData(formData);

  if (editingId) {
    records = records.map((record) => (record.id === editingId ? { ...record, ...values } : record));
    resetEditMode();
  } else {
    records.unshift({ id: crypto.randomUUID(), ...values });
    form.reset();
  }

  persist();
  renderRows();
});

cancelEditButton.addEventListener("click", () => {
  resetEditMode();
});

tbody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const id = button.dataset.id;
  const action = button.dataset.action;
  const record = records.find((item) => item.id === id);
  if (!record) {
    return;
  }

  if (action === "edit") {
    editingId = id;
    submitButton.textContent = "حفظ التعديل";
    cancelEditButton.hidden = false;
    fillForm(record);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (action === "delete") {
    records = records.filter((item) => item.id !== id);
    if (editingId === id) {
      resetEditMode();
    }
    persist();
    renderRows();
  }
});

bulkImportButton.addEventListener("click", () => {
  const text = bulkImportInput.value.trim();
  if (!text) {
    return;
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const imported = [];

  lines.forEach((line) => {
    const [deviceName = "", deviceCode = "", deviceModel = "", originCountry = "", serialNumber = "", voltAmpere = "", deviceAmpere = "", deviceUser = "", maintenancePlan = ""] = line.split("|").map((part) => part.trim());

    if (!deviceName || !deviceCode || !deviceModel) {
      return;
    }

    imported.push({
      id: crypto.randomUUID(),
      deviceName,
      deviceCode,
      deviceModel,
      originCountry,
      serialNumber,
      voltAmpere,
      deviceAmpere,
      deviceUser,
      maintenancePlan,
    });
  });

  if (!imported.length) {
    return;
  }

  records = [...imported, ...records];
  bulkImportInput.value = "";
  persist();
  renderRows();
});

searchInput.addEventListener("input", renderRows);
planFilter.addEventListener("change", renderRows);

renderRows();
