import { jidNormalizedUser, type GroupMetadata, type WASocket } from "baileys";
import { GetGroupMeta, isAdmin, isParticipant } from "../sql";

export class Community {
  sessionId: string;
  id: string;
  client: WASocket;
  metadata: GroupMetadata | undefined;
  constructor(sessionId: string, id: string, client: WASocket) {
    this.sessionId = sessionId;
    this.id = id;
    this.client = client;
    this.metadata = GetGroupMeta(sessionId, id);
  }

  async changeDisappearMsgTimer(ephemeralExpiration: number) {
    const participant = jidNormalizedUser(this.client.user?.id);
    if (
      this.metadata &&
      participant &&
      isParticipant(this.sessionId, this.metadata.id, participant)
    ) {
      if (isAdmin(this.sessionId, this.metadata.id, participant)) return null;
      await this.client.communityToggleEphemeral(this.id, ephemeralExpiration);

      return true;
    }
    return null;
  }

  async leave() {
    return await this.client.communityLeave(this.id);
  }

  async LinkGroup(groupId: string) {
    const participant = jidNormalizedUser(this.client.user?.id);
    if (
      this.metadata &&
      participant &&
      isParticipant(this.sessionId, this.metadata.id, participant)
    ) {
      if (isAdmin(this.sessionId, this.metadata.id, participant)) return null;
      if (GetGroupMeta(this.sessionId, groupId)?.linkedParent === this.id)
        return null;
      await this.client.communityLinkGroup(groupId, this.id);
      return true;
    }
    return null;
  }

  async UnlinkGroup(groupId: string) {
    const participant = jidNormalizedUser(this.client.user?.id);
    if (
      this.metadata &&
      participant &&
      isParticipant(this.sessionId, this.metadata.id, participant)
    ) {
      if (isAdmin(this.sessionId, this.metadata.id, participant)) return null;
      if (GetGroupMeta(this.sessionId, groupId)?.linkedParent !== this.id)
        return null;
      await this.client.communityUnlinkGroup(groupId, this.id);
      return true;
    }
    return null;
  }
}
