import React, { useMemo, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useErp } from '../store/erpStore';
import { computeProfitAndExpenses, formatCurrency } from '../utils/erpLogic';

const EXPENSE_CATEGORIES = [
  'Utilities',
  'Rent & Facility',
  'Logistics & Delivery',
  'Staff & Payroll',
  'Office & Supplies',
  'Maintenance',
  'Marketing',
  'Other',
];

export const ExpensesProfitView: React.FC = () => {
  const { db, addExpense, deleteExpense } = useErp();
  const currency = db.settings.currency || 'GHS';

  const [name, setName] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const summary = useMemo(() => computeProfitAndExpenses(db), [db]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const parsedAmount = Number.parseFloat(amount);
    const res = addExpense({
      name,
      category,
      amount: parsedAmount,
      date,
      notes,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setName('');
    setAmount('');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Financial Profit & Expense KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Sales Revenue</div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono-num">
            {formatCurrency(summary.totalSalesRevenue, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Gross receipts before COGS</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Estimated Gross Profit</div>
          <div className="mt-2 text-lg font-bold text-teal-700 font-mono-num">
            {formatCurrency(summary.estimatedGrossProfit, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Revenue minus COGS ({formatCurrency(summary.totalCogs, currency)})
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Expenses</div>
          <div className="mt-2 text-lg font-bold text-red-700 font-mono-num">
            {formatCurrency(summary.totalExpenses, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">All recorded operating costs</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">This Month&apos;s Expenses</div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono-num">
            {formatCurrency(summary.monthlyExpenses, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Monthly rev: {formatCurrency(summary.monthlyRevenue, currency)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Revenue Minus Expenses</div>
          <div className="mt-2 text-lg font-bold text-slate-900 font-mono-num">
            {formatCurrency(summary.revenueMinusExpenses, currency)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Est. Net Profit: {formatCurrency(summary.netOperatingProfit, currency)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record Expense Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 h-fit">
          <h2 className="text-base font-bold text-slate-900">Record New Expense</h2>
          <p className="text-xs text-slate-500 mt-1">
            Log operational costs to track net cash flow separately from sales revenue.
          </p>

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
              <label htmlFor="exp-name" className="block text-xs font-semibold text-slate-700 mb-1">
                Expense Name *
              </label>
              <input
                id="exp-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Generator Diesel Refill"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="exp-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <select
                id="exp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="exp-amt" className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount ({currency}) *
                </label>
                <input
                  id="exp-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="exp-date" className="block text-xs font-semibold text-slate-700 mb-1">
                  Date *
                </label>
                <input
                  id="exp-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono-num border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label htmlFor="exp-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                id="exp-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Save Expense</span>
            </button>
          </form>
        </div>

        {/* Category Breakdown & Expense List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-base font-bold text-slate-900 mb-4">
              Expense Breakdown by Category
            </h2>
            {summary.expensesByCategory.length === 0 ? (
              <p className="text-sm text-slate-500">No expenses recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {summary.expensesByCategory.map((item) => (
                  <div key={item.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">{item.category}</span>
                      <span className="font-mono-num font-bold text-slate-900">
                        {formatCurrency(item.amount, currency)} ({item.sharePct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-slate-900 rounded-full"
                        style={{ width: `${item.sharePct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Recorded Expenses Ledger</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Expense</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        No expenses recorded.
                      </td>
                    </tr>
                  ) : (
                    db.expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-mono-num text-xs text-slate-600 whitespace-nowrap">
                          {exp.date}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{exp.name}</div>
                          {exp.notes && <div className="text-xs text-slate-500">{exp.notes}</div>}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-700">{exp.category}</td>
                        <td className="py-2.5 px-4 text-right font-mono-num font-bold text-slate-900">
                          {formatCurrency(exp.amount, currency)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteExpense(exp.id)}
                            aria-label={`Delete expense ${exp.name}`}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
