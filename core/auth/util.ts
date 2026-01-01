import { StatusType } from "./types";

/**
 * Helper to check if a status represents a paused state
 */
export const UserPausedStatus = (status: StatusType): boolean =>
  status === StatusType.PausedUser;

export const VALID_STATUSES: StatusType[] = [
  StatusType.Connected,
  StatusType.Connecting,
  StatusType.Disconnected,
  StatusType.Pairing,
  StatusType.PausedUser,
  StatusType.PausedNetwork,
  StatusType.Active,
  StatusType.Inactive,
];
