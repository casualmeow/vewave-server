# Vewave Integration Checklist

1. Backend boot: copy `.env.example` to `.env`, set valid `DATABASE_URL`, then run `bun install`.
2. DB migration: run `bun run db:migrate` and verify `GET http://localhost:3001/api/health/db` reports `ok`.
3. Frontend env: copy frontend `.env.example` and keep `VITE_API_URL=http://localhost:3001`, `VITE_WS_URL=ws://localhost:3001`.
4. OpenAPI generation: start the backend, then run frontend `npm run api:gen`.
5. Registration/login: create an account, login, confirm `{ user, accessToken }`, and verify the refresh cookie is set.
6. Create a room: paste a supported YouTube/Vimeo/TikTok URL and confirm navigation to `/room/:code`.
7. Two tabs: open the same room code in two browser tabs.
8. Presence: verify `room.snapshot`, `presence.member.joined`, and `presence.member.left` update the participant list.
9. Sync: as the host, verify play, pause, and seek broadcast `playback.state` and both tabs apply the newest `version`.
10. Permission rejection: as a non-host viewer, verify playback controls are disabled or rejected with `command.rejected`.
