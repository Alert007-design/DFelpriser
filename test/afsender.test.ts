import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn(async (...args: unknown[]) => (void args, { data: { id: "e1" }, error: null }));
const batch = vi.fn(async (...args: unknown[]) => (void args, { data: { data: [{ id: "b1" }] }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
    batch = { send: batch };
  },
}));

import { resendAfsender } from "@/lib/mail/afsender";

const mail = { to: "a@eksempel.dk", subject: "s", html: "h", text: "t" };

describe("afsenderadresse", () => {
  beforeEach(() => {
    send.mockClear();
    batch.mockClear();
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "DF-Elpriser <bekraeft@eksempel.dk>";
    delete process.env.MAIL_FROM_NYHEDSBREV;
  });
  afterEach(() => {
    delete process.env.MAIL_FROM_NYHEDSBREV;
  });

  it("bruger MAIL_FROM til nyhedsbrevet, når MAIL_FROM_NYHEDSBREV ikke er sat", async () => {
    await resendAfsender().sendPortion([mail], "n");
    expect((batch.mock.calls[0][0] as { from: string }[])[0].from).toBe("DF-Elpriser <bekraeft@eksempel.dk>");
  });

  it("bruger MAIL_FROM_NYHEDSBREV til nyhedsbrevet, men altid MAIL_FROM til bekræftelsesmails", async () => {
    process.env.MAIL_FROM_NYHEDSBREV = "DF-Elpriser <nyhedsbrev@eksempel.dk>";
    const a = resendAfsender();
    await a.sendPortion([mail], "n");
    await a.send(mail);
    expect((batch.mock.calls[0][0] as { from: string }[])[0].from).toBe("DF-Elpriser <nyhedsbrev@eksempel.dk>");
    expect((send.mock.calls[0][0] as { from: string }).from).toBe("DF-Elpriser <bekraeft@eksempel.dk>");
  });

  it("behandler en tom MAIL_FROM_NYHEDSBREV som ikke sat", async () => {
    process.env.MAIL_FROM_NYHEDSBREV = "  ";
    await resendAfsender().sendPortion([mail], "n");
    expect((batch.mock.calls[0][0] as { from: string }[])[0].from).toBe("DF-Elpriser <bekraeft@eksempel.dk>");
  });
});
