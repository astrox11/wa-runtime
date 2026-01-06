import type { GroupMetadata } from "baileys";
import config from "../config";

const GO_SERVER = process.env.GO_SERVER || `http://localhost:${config.PORT}`;

async function apiRequest(endpoint: string, options?: RequestInit) {
  try {
    const response = await fetch(`${GO_SERVER}${endpoint}`, options);
    if (!response.ok) return null;
    const data = await response.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export function GetGroupMeta(sessionId: string, groupId: string): GroupMetadata | undefined {
  return undefined;
}

export function isAdmin(sessionId: string, groupId: string, participant: string): boolean {
  return false;
}

export function isParticipant(sessionId: string, groupId: string, participant: string): boolean {
  return false;
}

export function addContact(sessionId: string, phoneNumber: string, lid: string): void {
  fetch(`${GO_SERVER}/api/db/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, phone_number: phoneNumber, lid }),
  }).catch(() => {});
}

export function getAliveMessage(sessionId: string): string | null {
  return null;
}

export function setAliveMessage(sessionId: string, message: string): void {
  fetch(`${GO_SERVER}/api/db/alive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  }).catch(() => {});
}

export function getAfk(sessionId: string): { status: number; message?: string; time?: number } | null {
  return null;
}

export function setAfk(sessionId: string, status: boolean, message?: string, time?: number): void {
  fetch(`${GO_SERVER}/api/db/afk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, status: status ? 1 : 0, message, time }),
  }).catch(() => {});
}

export function getMentionData(sessionId: string, groupId: string): { type: string; message?: string; data?: any } | null {
  return null;
}

export function setMentionMessage(sessionId: string, groupId: string, data: { message?: string; type: string; data?: any }): void {
  fetch(`${GO_SERVER}/api/db/mention`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, group_id: groupId, ...data }),
  }).catch(() => {});
}

export function deleteMentionMessage(sessionId: string, groupId: string): void {
  fetch(`${GO_SERVER}/api/db/mention/${sessionId}/${groupId}`, {
    method: "DELETE",
  }).catch(() => {});
}
