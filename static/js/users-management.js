(() => {
'use strict';

const usersTableBody = document.getElementById('usersTableBody');
const userSearchInput = document.getElementById('userSearchInput');
const openUserModalButton = document.getElementById('openUserModalButton');
const userModal = document.getElementById('userModal');
const closeUserModalButton = document.getElementById('closeUserModalButton');
const userForm = document.getElementById('userForm');
const userNameInput = document.getElementById('userName');

let users = [];
let editingUserId = null;

function openUserModal() {
  userModal?.classList.remove('hidden');
}

function closeUserModal() {
  userModal?.classList.add('hidden');
}

function resetUserForm() {
  editingUserId = null;
  userForm.reset();
}

async function loadUsers() {
  const response = await fetch('/api/users');
  if (!response.ok) {
    throw new Error('تعذر تحميل المستخدمين.');
  }

  users = await response.json();
  renderUsers();
}

function renderUsers() {
  const q = userSearchInput.value.trim().toLowerCase();
  const filtered = users.filter((user) => user.name.toLowerCase().includes(q));

  if (!filtered.length) {
    usersTableBody.innerHTML = '<tr><td colspan="3">لا يوجد مستخدمون.</td></tr>';
    return;
  }

  usersTableBody.innerHTML = filtered
    .map(
      (user, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${user.name}</td>
        <td class="row-actions">
          <button type="button" class="action-btn action-edit" data-action="edit" data-id="${user.id}" title="تعديل" aria-label="تعديل">✏️</button>
          <button type="button" class="action-btn action-delete" data-action="delete" data-id="${user.id}" title="حذف" aria-label="حذف">🗑️</button>
        </td>
      </tr>
      `,
    )
    .join('');
}

async function createUser(name) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('تعذر إنشاء المستخدم.');
  }

  return response.json();
}

async function updateUser(id, name) {
  const response = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('تعذر تعديل المستخدم.');
  }

  return response.json();
}

async function deleteUser(id) {
  const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
  if (response.status === 409) {
    throw new Error('لا يمكن حذف مستخدم مرتبط بأجهزة.');
  }
  if (!response.ok) {
    throw new Error('تعذر حذف المستخدم.');
  }
}

openUserModalButton?.addEventListener('click', () => {
  resetUserForm();
  openUserModal();
});

closeUserModalButton?.addEventListener('click', () => closeUserModal());

userModal?.addEventListener('click', (event) => {
  if (event.target === userModal) {
    closeUserModal();
  }
});

userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = userNameInput.value.trim();

  try {
    if (editingUserId) {
      const updated = await updateUser(editingUserId, name);
      users = users.map((u) => (u.id === updated.id ? updated : u));
    } else {
      const created = await createUser(name);
      users.push(created);
    }

    users.sort((a, b) => a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }));
    renderUsers();
    closeUserModal();
    resetUserForm();
  } catch (error) {
    alert(error.message);
  }
});

usersTableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const user = users.find((u) => u.id === id);
  if (!user) {
    return;
  }

  if (action === 'edit') {
    editingUserId = id;
    userNameInput.value = user.name;
    openUserModal();
    return;
  }

  if (action === 'delete') {
    const confirmed = window.confirm('هل تريد حذف هذا المستخدم؟');
    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(id);
      users = users.filter((u) => u.id !== id);
      renderUsers();
    } catch (error) {
      alert(error.message);
    }
  }
});

userSearchInput.addEventListener('input', renderUsers);

loadUsers().catch((error) => {
  usersTableBody.innerHTML = `<tr><td colspan="3">${error.message}</td></tr>`;
});
})();
