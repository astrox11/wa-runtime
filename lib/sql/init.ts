import { BunQL } from "@realastrox11/bunql";

export const bunql = new BunQL({
  filename: "database.db",
  wal: true,
  create: true,
});
