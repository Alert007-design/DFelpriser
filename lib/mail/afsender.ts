import { Resend } from "resend";
import { kraev, valgfri } from "../config";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface Afsender {
  send(mail: Mail, idempotencyKey?: string): Promise<string>;
  /** Højst 100 mails pr. kald (Resends grænse). Returnerer Resend-id'er i samme rækkefølge. */
  sendPortion(mails: Mail[], idempotencyKey: string): Promise<string[]>;
}

export const PORTION = 100;

export function resendAfsender(): Afsender {
  const resend = new Resend(kraev("RESEND_API_KEY"));
  const from = kraev("MAIL_FROM");
  const replyTo = valgfri("MAIL_REPLY_TO");
  const med = (m: Mail) => ({ from, replyTo, ...m });
  return {
    async send(mail, idempotencyKey) {
      const { data, error } = await resend.emails.send(med(mail), idempotencyKey ? { idempotencyKey } : undefined);
      if (error || !data) throw new Error(`Resend: ${error?.message ?? "ukendt fejl"}`);
      return data.id;
    },
    async sendPortion(mails, idempotencyKey) {
      if (mails.length > PORTION) throw new Error(`Højst ${PORTION} mails pr. portion`);
      const { data, error } = await resend.batch.send(mails.map(med), { idempotencyKey });
      if (error || !data) throw new Error(`Resend: ${error?.message ?? "ukendt fejl"}`);
      return data.data.map((d) => d.id);
    },
  };
}
