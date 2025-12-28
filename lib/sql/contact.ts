import type { GroupParticipant } from "baileys";
import { bunql } from "./_sql";

const Contact = bunql.define("contacts", {
  pn: { type: "TEXT", primary: true },
  lid: { type: "TEXT" },
});

export const addContact = (pn: string, lid: string) => {
  if (pn && lid) {
    pn = pn?.split("@")[0];
    lid = lid?.split("@")[0];
    return Contact.upsert({ pn, lid });
  }
  return;
};

export const getAllContacts = () => {
  return Contact.all()
    .map((p) => p.pn)
    .map((e) => `${e}@s.whatsapp.net`);
};

export const getLidByPn = async (pn: string) => {
  const contact = Contact.find({ pn })[0];
  return contact?.lid + "@lid" || null;
};

export const getPnByLid = (lid: string) => {
  const contact = Contact.query().where("lid", "=", lid).first();
  return contact?.pn + "@s.whatsapp.net" || null;
};

export const getBothId = (id: string) => {
  const cleanId = (id.includes(":") ? id.split(":")[1] : id).split("@")[0];

  const contact = Contact.query()
    .where("pn", "=", cleanId)
    .orWhere("lid", "=", cleanId)
    .first();

  if (!contact) return null;

  return {
    pn: contact.pn + "@s.whatsapp.net",
    lid: contact.lid + "@lid",
  };
};

export const getAlternateId = (id: string) => {
  id = id?.split("@")?.[0];
  const contact = Contact.query()
    .where("pn", "=", id)
    .orWhere("lid", "=", id)
    .first();
  if (!contact) return null;
  return contact.pn === id
    ? contact.lid + "@lid"
    : contact.pn + "@s.whatsapp.net";
};

export const removeContact = (id: string) => {
  return Contact.delete().where("pn", "=", id).orWhere("lid", "=", id).run();
};

export const syncGroupParticipantsToContactList = (
  participants: GroupParticipant[],
) => {
  for (const participant of participants) {
    addContact(participant.phoneNumber, participant.id);
  }
};

export function parseId(input: string): string | null;
export function parseId(input: string[]): string[];
export function parseId(input: string | string[]): string | string[] | null {
  if (Array.isArray(input)) {
    return input
      .map((v) => parseId(v))
      .filter((v): v is string => typeof v === "string");
  }

  if (!input) return null;

  const clean = input.includes(":") ? input.split(":")[1] : input;
  const [rawBase, suffix] = clean.split("@");
  const base = rawBase.replace(/^@+/, "");

  if (suffix === "s.whatsapp.net") return `${base}@s.whatsapp.net`;
  if (suffix === "lid") return `${base}@lid`;

  const resolve = (pn?: string, lid?: string) => {
    if (pn === base || pn?.startsWith(base)) return `${pn}@s.whatsapp.net`;
    if (lid === base || lid?.startsWith(base)) return `${lid}@lid`;
    return null;
  };

  const contact = Contact.query()
    .where("pn", "=", base)
    .orWhere("lid", "=", base)
    .first();

  if (contact) {
    const resolved = resolve(contact.pn, contact.lid);
    if (resolved) return resolved;
  }

  const fuzzy = Contact.query()
    .where("pn", "LIKE", `${base}%`)
    .orWhere("lid", "LIKE", `${base}%`)
    .limit(1)
    .get()[0];

  if (fuzzy) {
    const resolved = resolve(fuzzy.pn, fuzzy.lid);
    if (resolved) return resolved;
  }

  return null;
}
