import type { CacheStore, WASocket } from "baileys";

export interface RuntimeSession {
  client: WASocket | null;
  msgRetryCounterCache: CacheStore;
}
