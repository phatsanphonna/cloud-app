import type { User } from "../user/model";

export interface LobbyInfo {
  id: string;
  roomCode: string;
  title: string;
  users: LobbyUser[];
  type: string;
}

export type LobbyUser = {
  id: string
  username: string
  profilePicture?: string
  money?: number
}