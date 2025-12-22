import { bunql } from "./_sql";

const Antidelete = bunql.define("antidelete", {
  active: { type: "INTEGER", primary: true },
  mode: { type: "TEXT" },
});

type AntideleteModes = "all" | "groups" | "p2p";

export const setAntidelete = (active: boolean, mode: AntideleteModes) => {
  Antidelete.query().where("active", "=", 1).orWhere("active", "=", 0);
  return Antidelete.insert({
    active: active ? 1 : 0,
    mode: mode,
  });
};
export const getAntidelete = () => {
  return Antidelete.all()[0];
};
