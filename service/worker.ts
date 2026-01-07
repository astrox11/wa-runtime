import {
  log,
  sessionManager,
  StatusType,
  getAllGroups,
  getActivitySettings,
  getAllMessages,
  getMessagesCount,
  GetGroupMeta,
  Group,
  Community,
  setActivitySettings,
  type ActivitySettings,
} from ".";
import config from "../config";

const GO_SERVER = process.env.GO_SERVER || "http://127.0.0.1:8000";

log.info("Starting WhatsApp service worker...");

function getStatusString(status: number): string {
  switch (status) {
    case StatusType.Connecting:
      return "connecting";
    case StatusType.Connected:
    case StatusType.Active:
      return "connected";
    case StatusType.Disconnected:
      return "disconnected";
    case StatusType.Pairing:
      return "pairing";
    case StatusType.PausedUser:
    case StatusType.PausedNetwork:
      return "paused";
    case StatusType.Inactive:
      return "inactive";
    default:
      return "inactive";
  }
}

async function pushStatsToGo() {
  try {
    const sessions = sessionManager.listExtended();
    const activeSessions = sessions.filter(
      (s) =>
        s.status === StatusType.Connected || s.status === StatusType.Active,
    ).length;

    let totalMessages = 0;
    for (const session of sessions) {
      totalMessages += getMessagesCount(session.id);
    }

    const payload = {
      overall: {
        totalSessions: sessions.length,
        activeSessions,
        totalMessages,
        version: config.VERSION,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        phone_number: s.phone_number,
        status: getStatusString(s.status),
        user_info: s.user_info ?? null,
        created_at: s.created_at,
      })),
    };

    await fetch(`${GO_SERVER}/api/bun/push/stats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    log.debug("Failed to push stats to Go:", e);
  }
}

async function handleGoRequest(
  action: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  switch (action) {
    case "getSessions":
      return sessionManager.listExtended().map((s) => ({
        id: s.id,
        phone_number: s.phone_number,
        status: s.status,
        user_info: s.user_info ?? null,
        created_at: s.created_at,
      }));

    case "getSession": {
      const session = sessionManager.get(params.id as string);
      if (!session) return { error: "Session not found" };
      return {
        id: session.id,
        phone_number: session.phone_number,
        status: session.status,
        user_info: session.user_info ?? null,
        created_at: session.created_at,
      };
    }

    case "createSession": {
      const createResult = await sessionManager.create(
        params.phoneNumber as string,
      );
      if (!createResult.success) return { error: createResult.error };
      return { id: createResult.id, code: createResult.code };
    }

    case "deleteSession": {
      const deleteResult = await sessionManager.delete(params.id as string);
      if (!deleteResult.success) return { error: deleteResult.error };
      return { message: "Session deleted successfully" };
    }

    case "pauseSession": {
      const pauseResult = await sessionManager.pause(params.id as string);
      if (!pauseResult.success) return { error: pauseResult.error };
      return { message: "Session paused successfully" };
    }

    case "resumeSession": {
      const resumeResult = await sessionManager.resume(params.id as string);
      if (!resumeResult.success) return { error: resumeResult.error };
      return { message: "Session resumed successfully" };
    }

    case "getGroups": {
      const groups = getAllGroups(params.sessionId as string);
      return { groups, total: groups.length };
    }

    case "getSettings":
      return getActivitySettings(params.sessionId as string);

    case "updateSettings": {
      const updated = setActivitySettings(
        params.sessionId as string,
        params.settings as Partial<ActivitySettings>,
      );
      return updated;
    }

    case "getMessages": {
      const limit = (params.limit as number) || 100;
      const offset = (params.offset as number) || 0;
      const messages = getAllMessages(
        params.sessionId as string,
        limit,
        offset,
      );
      const total = getMessagesCount(params.sessionId as string);
      let sent = 0;
      let received = 0;
      for (const m of messages) {
        if (m.message?.key?.fromMe === true) sent++;
        else if (m.message?.key?.fromMe === false) received++;
      }
      return { messages, total, sent, received };
    }

    case "getGroupMetadata": {
      const sessionId = params.sessionId as string;
      const groupId = params.groupId as string;
      const normalizedGroupId = groupId.includes("@g.us")
        ? groupId
        : `${groupId}@g.us`;
      const metadata = GetGroupMeta(sessionId, normalizedGroupId);
      if (!metadata) return { error: "Group not found" };

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
        id: metadata.id,
        subject: metadata.subject || "Unknown Group",
        owner: metadata.owner,
        creation: metadata.creation,
        desc: metadata.desc,
        isCommunity: metadata.isCommunity,
        isBotAdmin,
        size: metadata.size || metadata.participants?.length || 0,
        participants: (metadata.participants || []).map(
          (p: { id: string; admin?: string | null }) => ({
            id: p.id,
            admin: p.admin,
            isAdmin: p.admin === "admin" || p.admin === "superadmin",
          }),
        ),
      };
    }

    case "executeGroupAction": {
      const sessionId = params.sessionId as string;
      const groupId = params.groupId as string;
      const actionType = params.action as string;
      const actionParams = params.params as
        | Record<string, string | number | boolean>
        | undefined;

      const session = sessionManager.get(sessionId);
      if (!session) return { error: "Session not found" };

      const client = sessionManager.getClient(sessionId);
      if (!client) return { error: "Session not connected" };

      const normalizedGroupId = groupId.includes("@g.us")
        ? groupId
        : `${groupId}@g.us`;
      const group = new Group(sessionId, normalizedGroupId, client);
      const metadata = GetGroupMeta(sessionId, normalizedGroupId);
      const isCommunity = metadata?.isCommunity || false;
      const community = isCommunity
        ? new Community(sessionId, normalizedGroupId, client)
        : null;

      let result: unknown;
      let message = "Action completed successfully";

      switch (actionType) {
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
          message = "Invite link revoked";
          break;
        case "mute":
          result = await group.announce("announcement");
          message = "Group muted";
          break;
        case "unmute":
          result = await group.announce("not_announcement");
          message = "Group unmuted";
          break;
        case "lock":
          result = await group.restrict("locked");
          message = "Group locked";
          break;
        case "unlock":
          result = await group.restrict("unlocked");
          message = "Group unlocked";
          break;
        case "name":
          if (!actionParams?.name) return { error: "Name parameter required" };
          result = await group.name(actionParams.name as string);
          message = "Group name updated";
          break;
        case "description":
          result = await group.description(
            String(actionParams?.description || ""),
          );
          message = "Group description updated";
          break;
        default:
          return { error: `Unknown action: ${actionType}` };
      }

      return { success: true, message, data: result };
    }

    default:
      return { error: "Unknown action" };
  }
}

setInterval(pushStatsToGo, 2000);

process.on("SIGINT", () => {
  log.info("Received SIGINT, shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log.info("Received SIGTERM, shutting down...");
  process.exit(0);
});

const server = Bun.serve({
  port: parseInt(process.env.BUN_API_PORT || "8001", 10),
  hostname: process.env.HOST || "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/health" && req.method === "GET") {
      return Response.json({
        success: true,
        data: { status: "healthy", version: config.VERSION },
      });
    }

    if (path === "/api/action" && req.method === "POST") {
      try {
        const body = (await req.json()) as {
          action: string;
          params?: Record<string, unknown>;
        };
        const result = await handleGoRequest(body.action, body.params || {});
        const hasError =
          result && typeof result === "object" && "error" in result;
        setTimeout(pushStatsToGo, 100);
        return Response.json({
          success: !hasError,
          data: hasError ? undefined : result,
          error: hasError ? (result as { error: string }).error : undefined,
        });
      } catch (e) {
        return Response.json({
          success: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

log.info(`WhatsApp service worker listening on port ${server.port}`);

sessionManager
  .restore_all()
  .then(() => {
    log.info("Session restoration complete");
    pushStatsToGo();
  })
  .catch((error) => {
    log.error("Failed to restore sessions:", error);
  });
