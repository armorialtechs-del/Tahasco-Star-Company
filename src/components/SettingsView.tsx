import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, RotateCcw, Upload } from 'lucide-react';
import { useErp } from '../store/erpStore';
import { BrandLogo } from './BrandLogo';

export const SettingsView: React.FC = () => {
  const { db, updateSettings, importDatabaseJson, resetToDemoData } = useErp();

  const [form, setForm] = useState({ ...db.settings });
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSavedMsg('');
    const res = updateSettings(form);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setSavedMsg('Company settings updated across dashboard and receipts.');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tahasco-erp-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    setSavedMsg('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const res = importDatabaseJson(reader.result);
        if (!res.ok) {
          setErrorMsg(res.error);
        } else {
          setSavedMsg('Local database backup restored successfully.');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form
        onSubmit={handleSave}
        className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div>
          <h2 className="text-base font-bold text-slate-900">Company Profile &amp; Receipt Setup</h2>
          <p className="text-xs text-slate-500 mt-1">
            Changes update the sidebar branding, currency formatting, and printed customer receipts.
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {savedMsg && (
          <div
            role="status"
            className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{savedMsg}</span>
          </div>
        )}

        {/* Logo Row */}
        <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-slate-200">
          <BrandLogo
            logoDataUrl={form.logoDataUrl}
            companyName={form.companyName}
            size="lg"
          />
          <div className="space-y-1.5">
            <label htmlFor="set-logo" className="block text-xs font-semibold text-slate-700">
              Company Logo
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="set-logo"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:text-slate-700 file:font-medium"
              />
              {form.logoDataUrl && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, logoDataUrl: undefined }))}
                  className="text-xs font-medium text-red-700 hover:underline cursor-pointer"
                >
                  Use Default Emblem
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-cname" className="block text-xs font-semibold text-slate-700 mb-1">
              Company Name *
            </label>
            <input
              id="set-cname"
              type="text"
              required
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="set-tag" className="block text-xs font-semibold text-slate-700 mb-1">
              Business Tagline
            </label>
            <input
              id="set-tag"
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-phone" className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number *
            </label>
            <input
              id="set-phone"
              type="text"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="set-email" className="block text-xs font-semibold text-slate-700 mb-1">
              Company Email *
            </label>
            <input
              id="set-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label htmlFor="set-addr" className="block text-xs font-semibold text-slate-700 mb-1">
            Physical Address *
          </label>
          <input
            id="set-addr"
            type="text"
            required
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-curr" className="block text-xs font-semibold text-slate-700 mb-1">
              Currency Code *
            </label>
            <select
              id="set-curr"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="GHS">GHS — Ghana Cedis</option>
              <option value="USD">USD — US Dollars</option>
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-thresh" className="block text-xs font-semibold text-slate-700 mb-1">
              Default Low-Stock Threshold *
            </label>
            <input
              id="set-thresh"
              type="number"
              min="1"
              step="1"
              required
              value={form.defaultLowStockThreshold}
              onChange={(e) =>
                setForm({
                  ...form,
                  defaultLowStockThreshold: Number.parseInt(e.target.value, 10) || 10,
                })
              }
              className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label htmlFor="set-footer" className="block text-xs font-semibold text-slate-700 mb-1">
            Receipt Footer Message
          </label>
          <textarea
            id="set-footer"
            rows={2}
            value={form.receiptFooter}
            onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Save Company Settings
          </button>
        </div>
      </form>

      {/* Local Storage Data Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 h-fit">
        <div>
          <h2 className="text-base font-bold text-slate-900">Data Backup &amp; Storage</h2>
          <p className="text-xs text-slate-500 mt-1">
            All inventory, sales, receipts, expenses, and user records are persisted automatically
            in browser local storage. Export a JSON backup to transfer or archive records.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Full Backup (.json)</span>
          </button>

          <label className="w-full py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>Restore from Backup (.json)</span>
            <input
              type="file"
              accept="application/json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          <div className="pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={resetToDemoData}
              className="w-full py-2.5 px-4 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Sample Business Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
