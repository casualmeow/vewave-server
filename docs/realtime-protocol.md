# Vewave Realtime Protocol

Vewave uses a WebSocket-first realtime layer for room presence and playback synchronization. The backend synchronizes state only; it does not proxy, download, transcode, or re-stream provider media.

## Endpoint

```txt
GET /api/realtime/rooms/:code
```

Authentication is optional for viewing/presence and required for playback control. The gateway accepts:

- `Authorization: Bearer <accessToken>` when the client can set headers.
- `?accessToken=<accessToken>` for browser WebSocket clients.

Do not log URLs containing `accessToken`. Use TLS in deployed environments.

## Client Events

All client messages are JSON.

### `room.ping`

```json
{
  "type": "room.ping",
  "requestId": "client-generated-id"
}
```

### `playback.command`

Only the room owner/host can mutate playback state.

```json
{
  "type": "playback.command",
  "requestId": "client-generated-id",
  "payload": {
    "action": "play",
    "positionMs": 12450,
    "playbackRate": 1
  }
}
```

Supported actions:

- `play`
- `pause`
- `seek`
- `set_rate`

`seek` requires `positionMs`. `playbackRate` must be between `0.25` and `2`.

### `playback.rate.change`

Convenience event equivalent to `playback.command` with `action: "set_rate"`.

```json
{
  "type": "playback.rate.change",
  "requestId": "client-generated-id",
  "payload": {
    "playbackRate": 1.25,
    "positionMs": 33000
  }
}
```

## Server Events

All server messages use this envelope:

```json
{
  "type": "playback.state",
  "eventId": "server-generated-uuid",
  "roomCode": "public-room-code",
  "requestId": "client-generated-id-if-applicable",
  "payload": {}
}
```

### `room.snapshot`

Sent to a connection after it joins a room.

Presence members use this public shape:

```ts
type RealtimePresenceMember = {
  connectionId: string
  memberId: string | null
  userId: string | null
  name: string
  role: 'owner' | 'host' | 'viewer' | string
}
```

```json
{
  "type": "room.snapshot",
  "eventId": "uuid",
  "roomCode": "abc123",
  "payload": {
    "room": {
      "id": "uuid",
      "code": "abc123",
      "title": "Friday room",
      "visibility": "unlisted",
      "status": "active",
      "createdAt": "2026-05-19T12:00:00.000Z",
      "endedAt": null
    },
    "media": {
      "provider": "youtube",
      "externalId": "dQw4w9WgXcQ",
      "canonicalUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ"
    },
    "playback": {
      "status": "paused",
      "positionMs": 0,
      "effectivePositionMs": 0,
      "playbackRate": 1,
      "version": 0,
      "updatedAt": "2026-05-19T12:00:00.000Z",
      "serverTimeMs": 1779192000000
    },
    "permissions": {
      "role": "owner",
      "canControlPlayback": true
    },
    "presence": {
      "members": [
        {
          "connectionId": "connection-uuid",
          "memberId": "member-uuid",
          "userId": "user-uuid",
          "name": "Jane Doe",
          "role": "owner"
        }
      ]
    }
  }
}
```

### Other Server Events

- `room.pong`: response to `room.ping`.
- `presence.member.joined`: broadcast when a connection joins.
- `playback.state`: canonical playback state after an accepted command.
- `command.rejected`: validation, auth, or permission failure for a command.
- `error`: connection-level or unexpected realtime error.

`presence.member.joined` payload:

```json
{
  "member": {
    "connectionId": "connection-uuid",
    "memberId": "member-uuid",
    "userId": "user-uuid",
    "name": "Jane Doe",
    "role": "viewer"
  },
  "members": []
}
```

`presence.member.left` payload:

```json
{
  "connectionId": "connection-uuid",
  "memberId": "member-uuid",
  "userId": "user-uuid",
  "members": []
}
```

`command.rejected` payload:

```json
{
  "code": "PLAYBACK_COMMAND_FORBIDDEN",
  "message": "Only the room host can control playback.",
  "details": {}
}
```

## Synchronization Rules

The server is authoritative. Every accepted playback mutation:

1. Computes the current server-effective position.
2. Applies the command.
3. Persists the new state.
4. Increments `version`.
5. Broadcasts `playback.state`.

When state is `playing`, clients should compute current position from:

```txt
effectivePositionMs = positionMs + (clientNowMs - serverTimeMs) * playbackRate
```

Clients should ignore playback events with a `version` older than the version they have already applied.

## Current Scaling Boundary

The MVP uses `LocalRoomRealtimeTransport`, an in-memory connection registry suitable for one backend instance. Room and playback state are persisted in PostgreSQL. A Redis pub/sub or distributed presence adapter can replace the local transport without changing room services.

## Deferred

- TikTok short-link expansion, because redirect resolution requires explicit SSRF protections and domain allowlisting.
- Metadata enrichment for titles/thumbnails.
- Chat, playlists, host transfer, and Redis-backed multi-instance presence.
- WebTransport adapter.
