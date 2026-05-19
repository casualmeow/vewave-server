import type { PublicUser } from "../auth/auth.types";
import type { RoomRole } from "../rooms/rooms.types";
import type { ServerRoomEvent } from "./realtime.schemas";

export type ConnectedRoomMember = {
  connectionId: string;
  roomCode: string;
  roomId: string;
  memberId: string | null;
  userId: string | null;
  name: string;
  role: RoomRole;
  connectedAt: string;
};

export type RoomConnection = ConnectedRoomMember & {
  user: PublicUser | null;
  send(event: ServerRoomEvent): void;
};

export interface RoomRealtimeTransport {
  publishToRoom(roomCode: string, event: ServerRoomEvent): Promise<void> | void;
  publishToMember(
    connectionId: string,
    event: ServerRoomEvent,
  ): Promise<void> | void;
  getConnectedMembers(roomCode: string): ConnectedRoomMember[];
}

export class LocalRoomRealtimeTransport implements RoomRealtimeTransport {
  private readonly connections = new Map<string, RoomConnection>();
  private readonly roomConnections = new Map<string, Set<string>>();

  register(connection: RoomConnection) {
    this.connections.set(connection.connectionId, connection);

    const roomSet = this.roomConnections.get(connection.roomCode) ?? new Set();
    roomSet.add(connection.connectionId);
    this.roomConnections.set(connection.roomCode, roomSet);
  }

  remove(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return null;

    this.connections.delete(connectionId);
    const roomSet = this.roomConnections.get(connection.roomCode);
    roomSet?.delete(connectionId);

    if (roomSet?.size === 0) {
      this.roomConnections.delete(connection.roomCode);
    }

    return connection;
  }

  getConnection(connectionId: string) {
    return this.connections.get(connectionId) ?? null;
  }

  hasMemberConnection(roomCode: string, memberId: string) {
    return this.getConnectedMembers(roomCode).some(
      (member) => member.memberId === memberId,
    );
  }

  publishToRoom(roomCode: string, event: ServerRoomEvent) {
    const roomSet = this.roomConnections.get(roomCode);
    if (!roomSet) return;

    for (const connectionId of roomSet) {
      this.publishToMember(connectionId, event);
    }
  }

  publishToMember(connectionId: string, event: ServerRoomEvent) {
    this.connections.get(connectionId)?.send(event);
  }

  getConnectedMembers(roomCode: string): ConnectedRoomMember[] {
    const roomSet = this.roomConnections.get(roomCode);
    if (!roomSet) return [];

    return Array.from(roomSet)
      .map((connectionId) => this.connections.get(connectionId))
      .filter((connection): connection is RoomConnection => Boolean(connection))
      .map(({ send: _send, user: _user, ...member }) => member);
  }
}
