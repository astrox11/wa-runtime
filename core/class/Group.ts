import { jidNormalizedUser, type GroupMetadata, type WASocket } from "baileys";
import { GetGroupMeta, isAdmin, isParticipant } from "../sql";

export class Group {
  client: WASocket;
  metadata?: GroupMetadata;
  sessionId: string;

  constructor(sessionId: string, id: string, client: WASocket) {
    this.sessionId = sessionId;
    this.client = client;
    this.metadata = GetGroupMeta(sessionId, id);
  }

  private get id() {
    return this.metadata?.id;
  }

  async promote(participant: string) {
    if (!this.metadata) return false;
    if (isAdmin(this.sessionId, this.id!, participant)) return false;

    await this.client.groupParticipantsUpdate(
      this.id!,
      [participant],
      "promote",
    );
    return true;
  }

  async demote(participant: string) {
    if (!this.metadata) return false;
    if (!isAdmin(this.sessionId, this.id!, participant)) return false;

    await this.client.groupParticipantsUpdate(
      this.id!,
      [participant],
      "demote",
    );
    return true;
  }

  async remove(participant: string) {
    if (!isParticipant(this.sessionId, this.id!, participant)) return false;

    const result = await this.client.groupParticipantsUpdate(
      this.id!,
      [participant],
      "remove",
    );
    if (!result || result?.[0]?.status != "200") return false;
    return true;
  }

  async add(participant: string) {
    const result = await this.client.groupParticipantsUpdate(
      this.id!,
      [participant],
      "add",
    );

    if (!result || result?.[0]?.status != "200") return false;
    return true;
  }

  async leave() {
    if (!this.metadata) return false;

    await this.client.groupLeave(this.id!);
    return true;
  }

  async name(name: string) {
    await this.client.groupUpdateSubject(this.id!, name);
    return true;
  }

  async description(description: string) {
    await this.client.groupUpdateDescription(this.id!, description);
    return true;
  }

  async join_mode(mode: "admin_add" | "all_member_add") {
    if (!this.metadata) return false;
    const enabled = Boolean(this.metadata.memberAddMode);
    if (mode === "admin_add" && !enabled) return false;
    if (mode === "all_member_add" && enabled) return false;

    await this.client.groupMemberAddMode(this.id!, mode);
    return true;
  }

  async ephermal(duration: number) {
    if (!this.metadata) return false;
    if (this.metadata.ephemeralDuration === duration) return false;
    await this.client.groupToggleEphemeral(this.id!, duration);
    return true;
  }

  async kickall() {
    if (!this.metadata) return false;

    const self = jidNormalizedUser(this.client.user?.id);
    const participants = this.metadata.participants
      .filter(
        (p) =>
          p.admin == null && p.id !== self && p.id !== this.metadata?.owner,
      )
      .map((p) => p.id);

    if (!participants.length) return null;

    await this.client.groupParticipantsUpdate(this.id!, participants, "remove");
    return true;
  }

  async invite() {
    if (!this.metadata) return false;

    const code = await this.client.groupInviteCode(this.id!);
    if (!code) return false;
    return `https://chat.whatsapp.com/${code}`;
  }

  async revoke() {
    if (
      !isAdmin(
        this.sessionId,
        this.id!,
        jidNormalizedUser(this.client.user?.id),
      )
    )
      return false;

    const code = await this.client.groupRevokeInvite(this.id!);
    if (!code) return false;
    return `https://chat.whatsapp.com/${code}`;
  }

  async joinmode(mode: "on" | "off") {
    if (!this.metadata) return false;

    const enabled = Boolean(this.metadata.joinApprovalMode);
    if (mode === "on" && enabled) return false;
    if (mode === "off" && !enabled) return false;
    await this.client.groupJoinApprovalMode(this.id!, mode);
    return true;
  }

  async announce(
    mode: "announcement" | "not_announcement",
  ): Promise<boolean | null> {
    if (!this.metadata) return null;
    if (mode === "announcement" && this.metadata.announce) return null;
    if (mode === "not_announcement" && !this.metadata.announce) return null;

    await this.client.groupSettingUpdate(this.id!, mode);
    return true;
  }

  async restrict(mode: "locked" | "unlocked") {
    if (!this.metadata) return false;
    if (mode === "locked" && this.metadata.restrict) return false;
    if (mode === "unlocked" && !this.metadata.restrict) return false;

    await this.client.groupSettingUpdate(this.id!, mode);
    return true;
  }
}
