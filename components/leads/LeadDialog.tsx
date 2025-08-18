'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateLead } from '@/app/actions/leads';

type Lead = {
  id: string;
  patient_name: string | null;
  phone: string | null;
  note: string | null;
  status: 'new' | 'open' | 'closed' | null;
  source: string | null;
  created_at: string;
};

export default function LeadDialog({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [note, setNote] = useState(lead.note ?? '');
  const [status, setStatus] = useState<'new' | 'open' | 'closed'>(
    (lead.status as any) ?? 'new'
  );
  const [pending, startTransition] = useTransition();

  const waHref = lead.phone
    ? `https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
        `Hi ${lead.patient_name ?? ''}, thanks for reaching out!`
      )}`
    : undefined;

  async function handleSave() {
    startTransition(async () => {
      const res = await updateLead({ id: lead.id, note, status });
      if (!res.ok) {
        toast.error(res.error ?? 'Failed to update lead');
        return;
      }
      toast.success('Lead updated');
      setOpen(false);
      onClose();
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (!v ? (setOpen(false), onClose()) : null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[95vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl">
          <Dialog.Title className="text-xl font-semibold">
            Lead details
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-500">
            View and update the lead info. Changes save to Supabase.
          </Dialog.Description>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <label className="text-xs font-medium text-gray-600">Patient</label>
                <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2">
                  {lead.patient_name || '—'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Phone</label>
                <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2">
                  {lead.phone || '—'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Source</label>
                <div className="mt-1 rounded-lg border bg-gray-50 px-3 py-2">
                  {lead.source || 'microsite'}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Status</label>
                <div className="mt-1">
                  <Select.Root
                    value={status}
                    onValueChange={(v) =>
                      setStatus(v as 'new' | 'open' | 'closed')
                    }
                  >
                    <Select.Trigger className="w-full rounded-lg border px-3 py-2 text-left">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Content className="rounded-lg border bg-white shadow-lg">
                        <Select.Viewport className="p-1">
                          {['new', 'open', 'closed'].map((s) => (
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
                placeholder="Add context, symptoms, preferred time…"
              />
              <div className="mt-1 text-xs text-gray-400">
                Auto-saves only on Save button (below).
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-gray-500">
                Created: {new Date(lead.created_at).toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    WhatsApp
                  </a>
                )}
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
