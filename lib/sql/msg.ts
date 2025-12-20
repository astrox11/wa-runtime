import { proto, type WAMessageKey } from "baileys";
import { bunql } from "./init";

const Message = bunql.define("msg_users", {
  id: { type: "TEXT", primary: true },
  msg: { type: "TEXT" },
});

export const getMessage = async (key: WAMessageKey) => {
  const id = key.id;
  if (id) {
    const m = Message.find({ id }).run()[0];
    return m ? proto.Message.fromObject(JSON.parse(m.msg)) : undefined;
  }
  return undefined;
};
