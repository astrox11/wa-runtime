import { bunql } from "./init";

const Sudo = bunql.define("sudo_users", {
  pn: { type: "TEXT", primary: true },
  lid: { type: "TEXT" },
});

export const isSudo = (id: string) => {
  const pn = Sudo.all().map((e) => e.pn);
  const lid = Sudo.all().map((e) => e.lid);

  return [...pn, ...lid].includes(id);
};

export const addSudo = (id: string, lid: string) => {
  if (!isSudo(id)) {
    Sudo.insert({ pn: id, lid });
    return true;
  }
  return false;
};

export const removeSudo = (id: string) => {
  if (isSudo(id)) {
    Sudo.delete().where("pn", "=", id).orWhere("lid", "=", id).run();
    return true;
  }
  return false;
};
