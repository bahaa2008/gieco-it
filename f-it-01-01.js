const initialRecords = [
  {
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

const form = document.getElementById("deviceForm");
const tbody = document.getElementById("devicesTableBody");
const searchInput = document.getElementById("searchInput");
const planFilter = document.getElementById("planFilter");

let records = [...initialRecords];

function renderRows() {
  const query = searchInput.value.trim().toLowerCase();
  const plan = planFilter.value;

  const filtered = records.filter((record) => {
    const text = Object.values(record).join(" ").toLowerCase();
    const matchesSearch = query === "" || text.includes(query);
    const matchesPlan = plan === "" || record.maintenancePlan === plan;
    return matchesSearch && matchesPlan;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9">لا توجد بيانات مطابقة.</td></tr>';
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
      </tr>
    `,
    )
    .join("");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);

  const newRecord = {
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

  records.unshift(newRecord);
  form.reset();
  renderRows();
});

searchInput.addEventListener("input", renderRows);
planFilter.addEventListener("change", renderRows);

renderRows();
