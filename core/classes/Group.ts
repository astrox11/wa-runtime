import { jidNormalizedUser, type GroupMetadata, type WASocket } from "baileys";
import { GetGroupMeta, isAdmin, isParticipant } from "../sql";

export class Group {
  client: WASocket;
  metadata: GroupMetadata;
  sessionId: string;

  constructor(sessionId: string, id: string, client: WASocket) {
    this.sessionId = sessionId;
    this.metadata = GetGroupMeta(sessionId, id);
    this.client = client;
  }

  async Promote(participant: string) {
    if (isParticipant(this.sessionId, this.metadata.id, participant)) {
      if (isAdmin(this.sessionId, this.metadata.id, participant)) return null;
      await this.client.groupParticipantsUpdate(
        this.metadata.id,
        [participant],
        "promote",
      );
      return true;
    }
    return null;
  }

  async Demote(participant: string) {
    if (isParticipant(this.sessionId, this.metadata.id, participant)) {
      if (!isAdmin(this.sessionId, this.metadata.id, participant)) return null;
      await this.client.groupParticipantsUpdate(
        this.metadata.id,
        [participant],
        "demote",
      );
      return true;
    }
    return null;
  }

  async Remove(participant: string) {
    if (isParticipant(this.sessionId, this.metadata.id, participant)) {
      await this.client.groupParticipantsUpdate(
        this.metadata.id,
        [participant],
        "remove",
      );
      return true;
    }
    return null;
  }

  async Add(participant: string) {
    return await this.client.groupParticipantsUpdate(
      this.metadata.id,
      [participant],
      "add",
    );
  }

  async Leave() {
    return await this.client.groupLeave(this.metadata.id);
  }

  async Name(name: string) {
    return await this.client.groupUpdateSubject(this.metadata.id, name);
  }

  async Description(description: string) {
    return await this.client.groupUpdateDescription(
      this.metadata.id,
      description,
    );
  }

  async MemberJoinMode(mode: "admin_add" | "all_member_add") {
    if (mode === "admin_add" && !this.metadata.memberAddMode) return null;
    if (mode === "all_member_add" && this.metadata.memberAddMode) return null;
    await this.client.groupMemberAddMode(this.metadata.id, mode);
    return true;
  }

  async EphermalSetting(duration: number) {
    if (this.metadata.ephemeralDuration === duration) return null;
    await this.client.groupToggleEphemeral(this.metadata.id, duration);
    return true;
  }

  async KickAll() {
    const participants = this.metadata.participants
      .filter(
        (p) =>
          p.admin == null &&
          p.id !== jidNormalizedUser(this.client.user?.id) &&
          p.id !== this.metadata.owner,
      )
      .map((p) => p.id);

    return await this.client.groupParticipantsUpdate(
      this.metadata.id,
      participants,
      "remove",
    );
  }

  async InviteCode() {
    const invite = await this.client.groupInviteCode(this.metadata.id);
    return `https://chat.whatsapp.com/${invite}`;
  }

  async RevokeInvite() {
    const invite = await this.client.groupRevokeInvite(this.metadata.id);
    return `https://chat.whatsapp.com/${invite}`;
  }

  async GroupJoinMode(mode: "on" | "off") {
    if (mode === "on" && this.metadata.joinApprovalMode) return null;
    if (mode === "off" && !this.metadata.joinApprovalMode) return null;
    await this.client.groupJoinApprovalMode(this.metadata.id, mode);
    return true;
  }

  async SetAnnouncementMode(mode: "announcement" | "not_announcement") {
    if (mode === "announcement" && this.metadata.announce) return null;
    if (mode === "not_announcement" && !this.metadata.announce) return null;
    await this.client.groupSettingUpdate(this.metadata.id, mode);
    return true;
  }

  async SetRestrictedMode(mode: "locked" | "unlocked") {
    if (mode === "locked" && this.metadata.restrict) return null;
    if (mode === "unlocked" && !this.metadata.restrict) return null;
    await this.client.groupSettingUpdate(this.metadata.id, mode);
    return true;
  }
}
