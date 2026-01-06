import {
  sessionManager,
  StatusType,
  GetGroupMeta,
  Group,
  Community,
} from "../service";
import config from "../config";
import type {
  SessionStatsData,
  OverallStatsData,
  ActivitySettingsData,
  HourlyActivityData,
  GroupActionType,
} from "./types";

const GO_SERVER = process.env.GO_SERVER || "http://127.0.0.1:8000";

async function fetchFromGo<T>(endpoint: string): Promise<T | null> {
  try {
    const response = await fetch(`${GO_SERVER}${endpoint}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

async function postToGo<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const response = await fetch(`${GO_SERVER}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

async function putToGo<T>(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<T | null> {
  try {
    const response = await fetch(`${GO_SERVER}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

class RuntimeStats {
  getStats(_sessionId: string): SessionStatsData {
    return {
      messagesReceived: 0,
      messagesSent: 0,
    };
  }

  getHourlyActivity(_sessionId: string): HourlyActivityData {
    return {
      hourlyData: new Array(24).fill(0),
      peakHour: "12pm",
      average: 0,
    };
  }

  getOverallStats(): OverallStatsData {
    const sessions = sessionManager.listExtended();
    const activeSessions = sessions.filter(
      (s) =>
        s.status === StatusType.Connected || s.status === StatusType.Active,
    ).length;

    return {
      totalSessions: sessions.length,
      activeSessions,
      totalMessages: 0,
      version: config.VERSION,
    };
  }
}

export const runtimeStats = new RuntimeStats();

function formatHour(hour: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "am" : "pm";
  return `${h}${ampm}`;
}

function getStatusString(status: number): string {
  switch (status) {
    case StatusType.Connected:
    case StatusType.Active:
      return "active";
    case StatusType.Pairing:
      return "pairing";
    case StatusType.PausedUser:
      return "paused_user";
    case StatusType.Disconnected:
    case StatusType.Inactive:
      return "inactive";
    default:
      return "inactive";
  }
}

export function getSessions() {
  const sessions = sessionManager.listExtended();
  return {
    success: true,
    data: sessions.map((s) => ({
      id: s.id,
      phone_number: s.phone_number,
      status: s.status,
      user_info: s.user_info ?? null,
      created_at: s.created_at,
    })),
  };
}

export function getSession(idOrPhone: string | undefined) {
  if (!idOrPhone) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(idOrPhone);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  return {
    success: true,
    data: {
      id: session.id,
      phone_number: session.phone_number,
      status: session.status,
      user_info: session.user_info ?? null,
      created_at: session.created_at,
    },
  };
}

export async function createSession(phoneNumber: string) {
  const result = await sessionManager.create(phoneNumber);

  if (!result.success || !result.id) {
    return {
      success: false,
      error: result.error || "Failed to create session",
    };
  }

  return {
    success: true,
    data: {
      id: result.id,
      code: result.code,
    },
  };
}

export async function deleteSession(idOrPhone: string) {
  const result = await sessionManager.delete(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session deleted successfully" },
  };
}

export async function pauseSession(idOrPhone: string) {
  const result = await sessionManager.pause(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session paused successfully" },
  };
}

export async function resumeSession(idOrPhone: string) {
  const result = await sessionManager.resume(idOrPhone);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { message: "Session resumed successfully" },
  };
}

export function getAuthStatus(sessionId: string | undefined) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const isAuthenticated =
    session.status === StatusType.Connected ||
    session.status === StatusType.Active;

  return {
    success: true,
    data: {
      isAuthenticated,
      status: getStatusString(session.status),
      phoneNumber: session.phone_number,
    },
  };
}

export function getOverallStats() {
  return {
    success: true,
    data: runtimeStats.getOverallStats(),
  };
}

export function getFullStats() {
  const overallStats = runtimeStats.getOverallStats();
  const sessions = sessionManager.listExtended();

  return {
    success: true,
    data: {
      overall: overallStats,
      sessions: sessions.map((s) => ({
        id: s.id,
        phone_number: s.phone_number,
        status: getStatusString(s.status),
        user_info: s.user_info ?? null,
        created_at: s.created_at,
        pushName: s.user_info?.name,
        stats: runtimeStats.getStats(s.id),
        hourlyActivity: runtimeStats.getHourlyActivity(s.id),
      })),
    },
  };
}

export function getSessionStats(sessionId: string) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  return {
    success: true,
    data: runtimeStats.getStats(sessionId),
  };
}

export function getMessages(
  sessionId: string,
  _limit: number = 100,
  _offset: number = 0,
) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  return {
    success: true,
    data: {
      messages: [],
      total: 0,
    },
  };
}

export function getConfig() {
  return {
    success: true,
    data: {
      version: config.VERSION,
      botName: config.BOT_NAME,
    },
  };
}

export async function getGroups(sessionId: string) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    const data = await fetchFromGo<string>(
      `/api/db/groups?session_id=${sessionId}`,
    );
    const groups = data ? JSON.parse(data) : [];

    return {
      success: true,
      data: {
        groups,
        total: groups.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get groups",
    };
  }
}

export async function getActivitySettings(sessionId: string) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    const settings = await fetchFromGo<ActivitySettingsData>(
      `/api/db/settings?session_id=${sessionId}`,
    );
    return {
      success: true,
      data: settings || {
        always_online: false,
        typing: false,
        auto_read: false,
        auto_reject_calls: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get activity settings",
    };
  }
}

export async function updateActivitySettings(
  sessionId: string,
  settings: Partial<ActivitySettingsData>,
) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  try {
    const updatedSettings = await putToGo<ActivitySettingsData>(
      `/api/db/settings?session_id=${sessionId}`,
      settings as Record<string, unknown>,
    );
    return {
      success: true,
      data: updatedSettings,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update activity settings",
    };
  }
}

export function getGroupMetadata(sessionId: string, groupId: string) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  if (!groupId) {
    return { success: false, error: "Group ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const normalizedGroupId = groupId.includes("@g.us")
    ? groupId
    : `${groupId}@g.us`;

  try {
    const metadata = GetGroupMeta(sessionId, normalizedGroupId);

    if (!metadata) {
      return { success: false, error: "Group not found" };
    }

    const client = sessionManager.getClient(sessionId);
    const botJid = client?.user?.id
      ? client.user.id.split(":")[0] + "@s.whatsapp.net"
      : null;

    let isBotAdmin = false;
    if (botJid && metadata.participants) {
      const botParticipant = metadata.participants.find(
        (p: { id?: string; phoneNumber?: string }) =>
          p.id === botJid ||
          p.phoneNumber === botJid ||
          p.id?.split("@")[0] === botJid.split("@")[0] ||
          p.phoneNumber?.split("@")[0] === botJid.split("@")[0],
      );
      if (botParticipant) {
        isBotAdmin =
          botParticipant.admin === "admin" ||
          botParticipant.admin === "superadmin";
      }
    }

    return {
      success: true,
      data: {
        id: metadata.id,
        subject: metadata.subject || "Unknown Group",
        owner: metadata.owner,
        creation: metadata.creation,
        desc: metadata.desc,
        descOwner: metadata.descOwner,
        descId: metadata.descId,
        restrict: metadata.restrict,
        announce: metadata.announce,
        memberAddMode: metadata.memberAddMode,
        joinApprovalMode: metadata.joinApprovalMode,
        isCommunity: metadata.isCommunity,
        isBotAdmin,
        size: metadata.size || metadata.participants?.length || 0,
        participants: (metadata.participants || []).map(
          (p: {
            id: string;
            phoneNumber?: string;
            admin?: string | null;
            isAdmin?: boolean;
            isSuperAdmin?: boolean;
          }) => ({
            id: p.id,
            phoneNumber: p.phoneNumber,
            admin: p.admin,
            isAdmin:
              p.isAdmin || p.admin === "admin" || p.admin === "superadmin",
            isSuperAdmin: p.isSuperAdmin || p.admin === "superadmin",
          }),
        ),
        ephemeralDuration: metadata.ephemeralDuration,
        inviteCode: metadata.inviteCode,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get group metadata",
    };
  }
}

export async function executeGroupAction(
  sessionId: string,
  groupId: string,
  action: GroupActionType,
  params?: Record<string, string | number | boolean>,
) {
  if (!sessionId) {
    return { success: false, error: "Session ID is required" };
  }

  if (!groupId) {
    return { success: false, error: "Group ID is required" };
  }

  const session = sessionManager.get(sessionId);
  if (!session) {
    return { success: false, error: "Session not found" };
  }

  const client = sessionManager.getClient(sessionId);
  if (!client) {
    return { success: false, error: "Session not connected" };
  }

  const normalizedGroupId = groupId.includes("@g.us")
    ? groupId
    : `${groupId}@g.us`;

  try {
    const group = new Group(sessionId, normalizedGroupId, client);
    const metadata = GetGroupMeta(sessionId, normalizedGroupId);
    const isCommunity = metadata?.isCommunity || false;

    const adminOnlyActions = [
      "kickAll",
      "mute",
      "unmute",
      "lock",
      "unlock",
      "name",
      "description",
      "add",
      "remove",
      "promote",
      "demote",
      "ephemeral",
      "addMode",
      "joinMode",
      "inviteCode",
      "revokeInvite",
      "linkGroup",
      "unlinkGroup",
    ];

    if (adminOnlyActions.includes(action)) {
      const botJid = client.user?.id
        ? client.user.id.split(":")[0] + "@s.whatsapp.net"
        : null;

      if (!botJid) {
        return { success: false, error: "Bot JID not available" };
      }

      let isBotAdmin = false;
      if (metadata?.participants) {
        const botParticipant = metadata.participants.find(
          (p: { id?: string; phoneNumber?: string }) =>
            p.id === botJid ||
            p.phoneNumber === botJid ||
            p.id?.split("@")[0] === botJid.split("@")[0] ||
            p.phoneNumber?.split("@")[0] === botJid.split("@")[0],
        );
        if (botParticipant) {
          isBotAdmin =
            botParticipant.admin === "admin" ||
            botParticipant.admin === "superadmin";
        }
      }

      if (!isBotAdmin) {
        return {
          success: false,
          error:
            "Bot is not an admin in this group. Admin privileges required.",
        };
      }
    }

    const community = isCommunity
      ? new Community(sessionId, normalizedGroupId, client)
      : null;

    let result: unknown;
    let message = "Action completed successfully";

    switch (action) {
      case "leave":
        if (isCommunity && community) {
          result = await community.leave();
          message = "Left the community";
        } else {
          result = await group.leave();
          message = "Left the group";
        }
        break;

      case "kickAll":
        result = await group.kickall();
        message = "Kicked all non-admin participants";
        break;

      case "inviteCode":
        result = await group.invite();
        message = "Invite link generated";
        break;

      case "revokeInvite":
        result = await group.revoke();
        message = "Invite link revoked and new one generated";
        break;

      case "mute":
        result = await group.announce("announcement");
        if (result === null) {
          return { success: false, error: "Group is already muted" };
        }
        message = "Group muted (only admins can send messages)";
        break;

      case "unmute":
        result = await group.announce("not_announcement");
        if (result === null) {
          return { success: false, error: "Group is already unmuted" };
        }
        message = "Group unmuted (all members can send messages)";
        break;

      case "lock":
        result = await group.restrict("locked");
        if (result === null) {
          return { success: false, error: "Group is already locked" };
        }
        message = "Group locked (only admins can edit settings)";
        break;

      case "unlock":
        result = await group.restrict("unlocked");
        if (result === null) {
          return { success: false, error: "Group is already unlocked" };
        }
        message = "Group unlocked (all members can edit settings)";
        break;

      case "name":
        if (!params?.name || typeof params.name !== "string") {
          return { success: false, error: "Name parameter is required" };
        }
        result = await group.name(params.name);
        message = "Group name updated";
        break;

      case "description":
        if (params?.description === undefined) {
          return { success: false, error: "Description parameter is required" };
        }
        result = await group.description(String(params.description));
        message = "Group description updated";
        break;

      case "add":
        if (!params?.participant || typeof params.participant !== "string") {
          return { success: false, error: "Participant number is required" };
        }
        const addParticipant = params.participant.includes("@s.whatsapp.net")
          ? params.participant
          : params.participant + "@s.whatsapp.net";
        result = await group.add(addParticipant);
        message = "Participant added";
        break;

      case "remove":
        if (!params?.participant || typeof params.participant !== "string") {
          return { success: false, error: "Participant number is required" };
        }
        const removeParticipant = params.participant.includes("@s.whatsapp.net")
          ? params.participant
          : params.participant + "@s.whatsapp.net";
        result = await group.remove(removeParticipant);
        if (result === null) {
          return { success: false, error: "User not in group" };
        }
        message = "Participant removed";
        break;

      case "promote":
        if (!params?.participant || typeof params.participant !== "string") {
          return { success: false, error: "Participant number is required" };
        }
        const promoteParticipant = params.participant.includes(
          "@s.whatsapp.net",
        )
          ? params.participant
          : params.participant + "@s.whatsapp.net";
        result = await group.promote(promoteParticipant);
        if (result === null) {
          return {
            success: false,
            error: "User not in group or already admin",
          };
        }
        message = "Participant promoted to admin";
        break;

      case "demote":
        if (!params?.participant || typeof params.participant !== "string") {
          return { success: false, error: "Participant number is required" };
        }
        const demoteParticipant = params.participant.includes("@s.whatsapp.net")
          ? params.participant
          : params.participant + "@s.whatsapp.net";
        result = await group.demote(demoteParticipant);
        if (result === null) {
          return { success: false, error: "User not in group or not admin" };
        }
        message = "Participant demoted from admin";
        break;

      case "ephemeral":
        const duration =
          typeof params?.duration === "number"
            ? params.duration
            : parseInt(String(params?.duration));
        const acceptedDurations = [0, 86400, 604800, 7776000];
        if (isNaN(duration) || !acceptedDurations.includes(duration)) {
          return {
            success: false,
            error:
              "Invalid duration. Accepted values: 0 (off), 86400 (1 day), 604800 (7 days), 7776000 (90 days)",
          };
        }
        if (isCommunity && community) {
          result = await community.changeDisappearMsgTimer(duration);
        } else {
          result = await group.ephemeral(duration);
        }
        if (result === null) {
          return { success: false, error: "Already set to this duration" };
        }
        message =
          duration === 0
            ? "Disappearing messages disabled"
            : `Disappearing messages set to ${duration} seconds`;
        break;

      case "addMode":
        if (
          !params?.mode ||
          (params.mode !== "admin" && params.mode !== "member")
        ) {
          return { success: false, error: "Mode must be 'admin' or 'member'" };
        }
        result = await group.join_mode(
          params.mode === "admin" ? "admin_add" : "all_member_add",
        );
        if (result === null) {
          return { success: false, error: "Already set to this mode" };
        }
        message = `Member add mode set to ${params.mode}`;
        break;

      case "joinMode":
        if (
          !params?.mode ||
          (params.mode !== "approval" && params.mode !== "open")
        ) {
          return { success: false, error: "Mode must be 'approval' or 'open'" };
        }
        result = await group.joinmode(
          params.mode === "approval" ? "on" : "off",
        );
        if (result === null) {
          return { success: false, error: "Already set to this mode" };
        }
        message = `Join mode set to ${params.mode}`;
        break;

      case "linkGroup":
        if (!isCommunity || !community) {
          return {
            success: false,
            error: "This action is only available for communities",
          };
        }
        if (
          !params?.targetGroupId ||
          typeof params.targetGroupId !== "string"
        ) {
          return { success: false, error: "Target group ID is required" };
        }
        result = await community.LinkGroup(params.targetGroupId);
        if (result === null) {
          return {
            success: false,
            error:
              "Failed to link group - not an admin or group already linked",
          };
        }
        message = "Group linked to community";
        break;

      case "unlinkGroup":
        if (!isCommunity || !community) {
          return {
            success: false,
            error: "This action is only available for communities",
          };
        }
        if (
          !params?.targetGroupId ||
          typeof params.targetGroupId !== "string"
        ) {
          return { success: false, error: "Target group ID is required" };
        }
        result = await community.UnlinkGroup(params.targetGroupId);
        if (result === null) {
          return {
            success: false,
            error: "Failed to unlink group - not an admin or group not linked",
          };
        }
        message = "Group unlinked from community";
        break;

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }

    return {
      success: true,
      data: {
        success: true,
        message,
        data: result,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to execute group action",
    };
  }
}
