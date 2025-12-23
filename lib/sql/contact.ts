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

export const getLidByPn = async (pn: string) => {
  const contact = Contact.find({ pn })[0];
  return contact?.lid + "@lid" || null;
};

export const getPnByLid = (lid: string) => {
  const contact = Contact.query().where("lid", "=", lid).first();
  return contact?.pn + "@s.whatsapp.net" || null;
};

export const getAlternateId = (id: string) => {
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
    const results = input.map((id) => parseId(id)).filter(Boolean) as string[];
    return results;
  }

  if (!input || typeof input !== "string") return null;

  let cleanInput = input.includes(":") ? input.split(":")[1] : input;

  const parts = cleanInput.split("@");
  const baseId = parts[0];
  const suffix = parts[1];

  const sanitizedBaseId = baseId.replace(/^@+/, "");

  if (suffix === "s.whatsapp.net") {
    return `${sanitizedBaseId}@s.whatsapp.net`;
  }
  if (suffix === "lid") {
    return `${sanitizedBaseId}@lid`;
  }

  let contact = Contact.query()
    .where("pn", "=", sanitizedBaseId)
    .orWhere("lid", "=", sanitizedBaseId)
    .first();

  if (contact) {
    return contact.pn === sanitizedBaseId
      ? `${sanitizedBaseId}@s.whatsapp.net`
      : `${sanitizedBaseId}@lid`;
  }

  const fuzzyMatches = Contact.query()
    .where("pn", "LIKE", `${sanitizedBaseId}%`)
    .orWhere("lid", "LIKE", `${sanitizedBaseId}%`)
    .limit(1)
    .get();

  if (fuzzyMatches.length > 0) {
    contact = fuzzyMatches[0];

    if (contact.pn?.startsWith(sanitizedBaseId)) {
      return `${contact.pn}@s.whatsapp.net`;
    }
    if (contact.lid?.startsWith(sanitizedBaseId)) {
      return `${contact.lid}@lid`;
    }
  }

  return null;
}
