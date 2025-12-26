import { jidNormalizedUser } from "baileys/src";
import { bunql } from "./_sql";

const Sudo = bunql.define("sudo", {
  pn: { type: "TEXT", primary: true },
  lid: { type: "TEXT" },
});

export const isSudo = (id: string) => {
  const pn = Sudo.all().map((e) => e.pn);
  const lid = Sudo.all().map((e) => e.lid);

  return [...pn, ...lid].includes(id);
};

export const addSudo = (id: string, lid: string) => {
  id = jidNormalizedUser(id);
  lid = jidNormalizedUser(lid);
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

export const getSudos = () => {
  return Sudo.all();
};
