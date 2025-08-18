'use client';

// @ts-nocheck
import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updatePayment } from '@/app/actions/payments';

type AnyPayment = {
  id: string;
  created_at?: string;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  method?: string | null;
  source?: string | null;
  note?: string | null;
  payer_name?: string | null;
  phone?: string | null;
  [key: string]: any;
};

const STATUS_OPTIONS = [
  'new',
  'pending',
  'paid',
  'captured',
  'settled',
  'failed',
  'refunded',
];

export default function PaymentDialog({
  payment,
  onClose,
}: {
  payment: AnyPayment;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState(payment.note ?? '');
  const [status, setStatus] = useState<string>(payment.status ?? 'new');
  const [pending, startTransition] = useTransition();

  const amountNum =
    typeof payment.amount === 'number'
      ? payment.amount
      : Number(payment.amount ?? 0) || undefined;

  const displayAmount =
    typeof amountNum === 'number'
      ? `${payment.currency || 'INR'} ${amountNum.toFixed(2)}`
      : '—';

  async function handleSave() {
    startTransition(async () => {
      const res = await updatePayment({ id: payment.id, note, status });
      if (!res.ok) {
        toast.error(res.error ?? 'Failed to update payment');
        return;
      }
      toast.success('Payment updated');
      setOpen(false);
      onClose();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (!v ? (setOpen(false), onClose()) : null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl">
          <Dialog.Title className="text-xl font-semibold">Payment details</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-500">
            Review and update payment fields. Saves to Supabase.
          </Dialog.Description>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Payer</label>
                <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2">
                  {payment.payer_name || '—'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Phone</label>
                <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2">
                  {payment.phone || '—'}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600">Amount</label>
                <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2">
                  {displayAmount}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Method</label>
                <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2">
                  {payment.method || '—'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Status</label>
                <div className="mt-1">
                  <Select.Root
                    value={status}
                    onValueChange={(v) => setStatus(v)}
                  >
                    <Select.Trigger className="w-full rounded-lg border px-3 py-2 text-left">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="rounded-lg border bg-white shadow-lg">
                        <Select.Viewport className="p-1">
                          {STATUS_OPTIONS.map((s) => (
                            <Select.Item
                              key={s}
                              value={s}
                              className="cursor-pointer rounded-md px-3 py-2 text-sm hover:bg-gray-100"
                            >
                              <Select.ItemText>{s}</Select.ItemText>
                            </Select.Item>
                          ))}
                        </Select.Viewport>
                      </Select.Content>
                    </Select.Portal>
                  </Select.Root>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Note</label>
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add payment context, reference IDs, settlement notes…"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">
                Created: {payment.created_at ? new Date(payment.created_at).toLocaleString() : '—'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={pending}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60"
                >
                  {pending ? 'Saving…' : 'Save'}
                </button>
                <Dialog.Close asChild>
                  <button className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
