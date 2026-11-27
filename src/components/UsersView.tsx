import React, { useState } from 'react';
import { AlertCircle, Edit2, Plus, Shield, Trash2, UserCheck, X } from 'lucide-react';
import { useErp } from '../store/erpStore';
import type { User, UserRole } from '../types/erp';

export const UsersView: React.FC = () => {
  const { db, currentUser, createUser, updateUser, clearUsers, removeUser } = useErp();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [clearAllModalOpen, setClearAllModalOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'remove_others' | 'reset_roles_to_staff'>('remove_others');
  const [removingUser, setRemovingUser] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'staff' as UserRole,
    password: '',
    active: true,
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setErrorMsg('');
    setForm({
      name: '',
      username: '',
      email: '',
      role: 'staff',
      password: '',
      active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setErrorMsg('');
    setForm({
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      password: '',
      active: u.active,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (editingUser) {
      const res = updateUser(editingUser.id, {
        name: form.name,
        username: form.username,
        email: form.email,
        role: form.role,
        active: form.active,
        newPassword: form.password.trim() || undefined,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
    } else {
      const res = createUser({
        name: form.name,
        username: form.username,
        email: form.email,
        role: form.role,
        password: form.password,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
    }
    setModalOpen(false);
  };

  const otherUsersCount = db.users.filter((u) => u.id !== currentUser?.id).length;
  const canClearUsersOrRoles = otherUsersCount > 0 || db.passwordResetTokens.length > 0;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">User Accounts &amp; Permissions</h2>
          <p className="text-xs text-slate-500">
            Manage Admin and Sales Staff accounts, roles, and access status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setClearMode('remove_others');
              setClearAllModalOpen(true);
            }}
            disabled={!canClearUsersOrRoles}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Users &amp; Roles</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Role Summary Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Shield className="w-4 h-4 text-slate-900" />
            <span>Administrator Role</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            Full access: add/edit/delete inventory, adjust stock, view all company sales, manage
            expenses, view 30-day &amp; monthly revenue reports, manage users, and edit company
            settings.
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UserCheck className="w-4 h-4 text-teal-700" />
            <span>Sales Staff Role</span>
          </div>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            POS &amp; counter access: record customer sales, view available inventory, generate and
            print A4/80mm receipts, and view their own recorded sales history.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {u.name}
                    {u.id === currentUser?.id && (
                      <span className="ml-2 text-xs font-normal text-teal-700">(You)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono-num text-xs text-slate-700">{u.username}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{u.email}</td>
                  <td className="py-3 px-4 text-xs font-semibold capitalize text-slate-800">
                    {u.role === 'admin' ? 'Administrator' : 'Sales Staff'}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    {u.active ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-red-700">Deactivated</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        aria-label={`Edit user ${u.name}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          type="button"
                          onClick={() => setRemovingUser(u)}
                          aria-label={`Clear user ${u.name}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingUser ? 'Edit User' : 'Add User'}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingUser ? `Edit Account — ${editingUser.name}` : 'Create Staff Account'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close user modal"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
              <div>
                <label htmlFor="usr-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  id="usr-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="usr-uname" className="block text-xs font-semibold text-slate-700 mb-1">
                    Username *
                  </label>
                  <input
                    id="usr-uname"
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="usr-role" className="block text-xs font-semibold text-slate-700 mb-1">
                    Role *
                  </label>
                  <select
                    id="usr-role"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="staff">Sales Staff</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="usr-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  id="usr-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="usr-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <input
                  id="usr-pass"
                  type="password"
                  required={!editingUser}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {editingUser && (
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span>Account is active and allowed to sign in</span>
                </label>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  {editingUser ? 'Save User' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {clearAllModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Clear user accounts and roles confirmation"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear User Accounts &amp; Roles</h2>
              <button
                type="button"
                onClick={() => setClearAllModalOpen(false)}
                aria-label="Close clear users dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Your signed-in Administrator account (<strong>{currentUser?.name}</strong>) stays active so you are never locked out. Choose how to clear the remaining {otherUsersCount} account(s) and password reset tokens:
            </p>
            <div className="mt-4 space-y-2.5">
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="clear-users-mode"
                  checked={clearMode === 'remove_others'}
                  onChange={() => setClearMode('remove_others')}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-slate-900 block">
                    Clear all other user accounts ({otherUsersCount})
                  </strong>
                  Removes all other staff and admin accounts along with saved password reset tokens. Historical sales receipts remain intact.
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="clear-users-mode"
                  checked={clearMode === 'reset_roles_to_staff'}
                  onChange={() => setClearMode('reset_roles_to_staff')}
                  className="mt-0.5"
                />
                <span>
                  <strong className="text-slate-900 block">
                    Reset all other users&apos; roles to Sales Staff
                  </strong>
                  Keeps all accounts in place, removes Administrator roles from every other user, and clears password reset tokens.
                </span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearAllModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearUsers(clearMode);
                  setClearAllModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg cursor-pointer"
              >
                {clearMode === 'remove_others' ? 'Clear Other Accounts' : 'Reset Other Roles'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removingUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Clear user ${removingUser.name} confirmation`}
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Clear User Account</h2>
              <button
                type="button"
                onClick={() => setRemovingUser(null)}
                aria-label="Close remove user dialog"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Remove user account <strong>{removingUser.name}</strong> ({removingUser.role === 'admin' ? 'Administrator' : 'Sales Staff'}) and clear its password reset tokens? Any past sales recorded by this user will remain in Sales History.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemovingUser(null)}
                className="px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeUser(removingUser.id);
                  setRemovingUser(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-red-700 hover:bg-red-800 text-white rounded-lg cursor-pointer"
              >
                Clear User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
