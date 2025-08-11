// lib/notify.ts
// @ts-nocheck
type LeadNotice = {
  toEmail: string | null;
  dentistName?: string | null;
  micrositeSlug?: string | null;
  patientName: string;
  patientPhone: string;
  note?: string;
};

export async function sendLeadEmail(notice: LeadNotice) {
  const { toEmail, dentistName, micrositeSlug, patientName, patientPhone, note } = notice;

  // Fallback to console if no recipient or no Resend key
  if (!toEmail || !process.env.RESEND_API_KEY) {
    console.log('[Notify] New lead', { toEmail, dentistName, micrositeSlug, patientName, patientPhone, note });
    return { ok: true, fallback: true };
  }

  const from = process.env.NOTIFY_FROM_EMAIL || 'onboarding@resend.dev';
  const replyTo = process.env.NOTIFY_REPLY_TO || '';

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const subject = `🆕 New lead from ${micrositeSlug || 'microsite'}`;
  const lines = [
    `Hi${dentistName ? ' ' + dentistName : ''},`,
    ``,
    `You’ve received a new appointment request.`,
    ``,
    `Name: ${patientName}`,
    `Phone: ${patientPhone}`,
    note ? `Note: ${note}` : null,
    micrositeSlug ? `Microsite: /book/${micrositeSlug}` : null,
    ``,
    `— Vyapr`,
  ].filter(Boolean);

  const html = `<pre style="font:14px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${lines.join('\n')}</pre>`;

  const { error } = await resend.emails.send({
    from,
    to: [toEmail],
    subject,
    html,
    ...(replyTo ? { reply_to: replyTo } : {}),
  });

  if (error) throw error;
  return { ok: true };
}
