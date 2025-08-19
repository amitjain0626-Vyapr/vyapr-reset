// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';

// This dialog supports two usage patterns:
//  A) Conditional render with `payment` (what your PaymentsTable does):
//     {selected && <PaymentDialog payment={selected} onClose={...} />}
//  B) Controlled with `open` + `initial`:
//
// Props accepted (all optional except onClose):
// - payment: existing payment object (AnyPayment-like) to edit
// - open: boolean (alternative control flag)
// - onClose: () => void
// - onSave: (payload:any) => Promise<void> | void
// - initial: seed values when creating
// - title: string
export default function PaymentDialog(props: any) {
  const {
    payment = null,
    open = false,
    onClose,
    onSave = async () => {},
    initial = null,
    title,
  } = props;

  const isOpen = Boolean(payment) || Boolean(open);

  // Derive starting values from `payment` first, then `initial`
  const seed = payment ?? initial ?? {};
  const [amount, setAmount] = useState<string>((seed.amount ?? '').toString());
  const [currency, setCurrency] = useState<string>(seed.currency ?? 'INR');
  const [status, setStatus] = useState<string>(seed.status ?? 'pending');
  const [method, setMethod] = useState<string>(seed.method ?? '');
  const [payerName, setPayerName] = useState<string>(seed.payer_name ?? '');
  const [phone, setPhone] = useState<string>(seed.phone ?? '');
  const [note, setNote] = useState<string>(seed.note ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Re-seed when dialog opens or selected payment changes
    if (isOpen) {
      const s = payment ?? initial ?? {};
      setAmount((s.amount ?? '').toString());
      setCurrency(s.currency ?? 'INR');
      setStatus(s.status ?? 'pending');
      setMethod(s.method ?? '');
      setPayerName(s.payer_name ?? '');
      setPhone(s.phone ?? '');
      setNote(s.note ?? '');
      setError(null);
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, payment]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        amount: amount ? Number(amount) : null,
        currency: currency || 'INR',
        status: status || 'pending',
        method: method || null,
        payer_name: payerName || null,
        phone: phone || null,
        note: note || null,
      };
      await onSave(payload);
      onClose?.();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const heading =
    title ??
    (payment ? 'Edit Payment' : 'Create / Edit Payment');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{heading}</h2>
          {error && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500">Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="1999"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">Currency</label>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="INR"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="pending">pending</option>
                <option value="created">created</option>
                <option value="paid">paid</option>
                <option value="failed">failed</option>
                <option value="refunded">refunded</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Method</label>
              <input
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="UPI / Card / Cash"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500">Payer name</label>
            <input
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Rahul Sharma"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="+91XXXXXXXXXX"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">Note</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Optional notes"
              rows={3}
            />
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
