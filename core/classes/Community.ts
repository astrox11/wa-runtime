import type { WASocket } from "baileys";

export class Community {
  id: string;
  client: WASocket;
  constructor(id: string, client: WASocket) {
    this.id = id;
    this.client = client;
  }

  /**
   * TO DO: Implement
   */
}
