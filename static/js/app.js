const isoForms = [
  {
    id: "7-1",
    name: "بيان بأجهزة الــ ( LAP - PC - الأجهزة المساعدة )",
    code: "F-IT-01-01",
    retention: "يحدث دوريا",
  },
  {
    id: "7-2",
    name: "الخطة السنوية للصيانة",
    code: "F-IT-01-02",
    retention: "يحدث دوريا",
  },
  {
    id: "7-3",
    name: "إخطار صيانة",
    code: "F-IT-01-03",
    retention: "سنة واحدة",
  },
  {
    id: "7-4",
    name: "أمر شغل",
    code: "F-IT-01-04",
    retention: "سنة واحدة",
  },
  {
    id: "7-5",
    name: "سجل تاريخي لجهاز",
    code: "F-IT-01-05",
    retention: "يحدث دوريا",
  },
  {
    id: "7-6",
    name: "طلب صيانة خارجي",
    code: "F-IT-01-06",
    retention: "سنة واحدة",
  },
  {
    id: "7-7",
    name: "تقرير فحص الأجهزة",
    code: "F-IT-01-07",
    retention: "سنة واحدة",
  },
  {
    id: "7-8",
    name: "إقرار إستلام جهاز",
    code: "F-IT-01-08",
    retention: "دائم",
  },
  {
    id: "7-9",
    name: "طلب إستخدام مواقع الإنترنت",
    code: "F-IT-01-09",
    retention: "سنة واحدة",
  },
  {
    id: "7-10",
    name: "طلب إنشاء حساب لموظف",
    code: "F-IT-01-10",
    retention: "سنة واحدة",
  },
];

const formsTableBody = document.getElementById("formsTableBody");
const recordsTableBody = document.getElementById("recordsTableBody");
const modelCode = document.getElementById("modelCode");
const recordForm = document.getElementById("recordForm");
const searchInput = document.getElementById("searchInput");
const emptyTemplate = document.getElementById("emptyState");

const storageKey = "iso-it-records-v1";
let records = JSON.parse(localStorage.getItem(storageKey) || "[]");

function renderFormsReference() {
  formsTableBody.innerHTML = isoForms
    .map(
      (form) => `
      <tr>
        <td>${form.id}</td>
        <td>${form.name}</td>
        <td>${form.code}</td>
        <td>${form.retention}</td>
      </tr>
    `,
    )
    .join("");
}

function renderModelOptions() {
  modelCode.innerHTML = isoForms
    .map((form) => `<option value="${form.code}">${form.code} - ${form.name}</option>`)
    .join("");
}

function statusClass(status) {
  return `status-${status.replaceAll(" ", "-")}`;
}

function renderRecords(filter = "") {
  const normalized = filter.trim().toLowerCase();
  const filtered = records.filter((record) => {
    const hay = [
      record.code,
      record.formName,
      record.itemName,
      record.department,
      record.owner,
      record.status,
    ]
      .join(" ")
      .toLowerCase();

    return hay.includes(normalized);
  });

  if (!filtered.length) {
    recordsTableBody.innerHTML = "";
    recordsTableBody.append(emptyTemplate.content.cloneNode(true));
    return;
  }

  recordsTableBody.innerHTML = filtered
    .map(
      (record) => `
      <tr>
        <td>${record.code}</td>
        <td>${record.formName}</td>
        <td>${record.itemName}</td>
        <td>${record.department}</td>
        <td>${record.owner}</td>
        <td>${record.actionDate}</td>
        <td><span class="tag ${statusClass(record.status)}">${record.status}</span></td>
        <td>${record.retention}</td>
      </tr>
    `,
    )
    .join("");
}

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(records));
}

recordForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const selected = isoForms.find((f) => f.code === modelCode.value);
  if (!selected) {
    return;
  }

  const record = {
    code: selected.code,
    formName: selected.name,
    retention: selected.retention,
    itemName: document.getElementById("itemName").value.trim(),
    department: document.getElementById("department").value.trim(),
    owner: document.getElementById("owner").value.trim(),
    actionDate: document.getElementById("actionDate").value,
    status: document.getElementById("status").value,
    notes: document.getElementById("notes").value.trim(),
  };

  records.unshift(record);
  persist();
  renderRecords(searchInput.value);
  recordForm.reset();
  modelCode.value = selected.code;
});

searchInput.addEventListener("input", () => {
  renderRecords(searchInput.value);
});

renderFormsReference();
renderModelOptions();
renderRecords();
