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

/** Afsender på bekræftelsesmails og driftsbeskeder: altid MAIL_FROM. */
export function fraTilBekraeftelse(): string {
  return kraev("MAIL_FROM");
}

/** Afsender på nyhedsbrevet: MAIL_FROM_NYHEDSBREV, og er den ikke sat, MAIL_FROM som før. */
export function fraTilNyhedsbrev(): string {
  return valgfri("MAIL_FROM_NYHEDSBREV") ?? kraev("MAIL_FROM");
}

export function resendAfsender(): Afsender {
  const resend = new Resend(kraev("RESEND_API_KEY"));
  const fra = fraTilBekraeftelse();
  const fraNyhedsbrev = fraTilNyhedsbrev();
  const replyTo = valgfri("MAIL_REPLY_TO");
  const med = (from: string) => (m: Mail) => ({ from, replyTo, ...m });
  return {
    async send(mail, idempotencyKey) {
      const { data, error } = await resend.emails.send(med(fra)(mail), idempotencyKey ? { idempotencyKey } : undefined);
      if (error || !data) throw new Error(`Resend: ${error?.message ?? "ukendt fejl"}`);
      return data.id;
    },
    async sendPortion(mails, idempotencyKey) {
      if (mails.length > PORTION) throw new Error(`Højst ${PORTION} mails pr. portion`);
      const { data, error } = await resend.batch.send(mails.map(med(fraNyhedsbrev)), { idempotencyKey });
      if (error || !data) throw new Error(`Resend: ${error?.message ?? "ukendt fejl"}`);
      return data.data.map((d) => d.id);
    },
  };
}
