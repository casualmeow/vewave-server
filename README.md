# Vewave API

Bun/Elysia backend for Vewave watch-together rooms. The API handles auth, external video URL parsing, room creation, durable room playback state, and WebSocket-based realtime synchronization.

The backend synchronizes room state only. It does not proxy, download, transcode, or re-stream YouTube, Vimeo, TikTok, or other provider media.

## Getting Started

Install dependencies:

```bash
bun install
```

Create a local environment file:

```bash
cp .env.example .env
```

Start PostgreSQL and create the database named in `DATABASE_URL`, then apply migrations:

```bash
bun run db:migrate
```

Run the API:

```bash
bun run dev
```

By default the API listens on `http://localhost:3001`.

For Docker or LAN access, set `API_HOST=0.0.0.0`. Local OpenAPI generation from the frontend expects the backend to be reachable at `http://localhost:3001`.

## API Docs

OpenAPI docs are served at:

```txt
http://localhost:3001/openapi
```

The generated spec is available at:

```txt
http://localhost:3001/openapi/json
```

## REST Endpoints

- `GET /api/health`
- `GET /api/health/db`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/media/parse-url`
- `POST /api/rooms`
- `GET /api/rooms/:code`
- `POST /api/rooms/:code/join`

Protected endpoints use `Authorization: Bearer <accessToken>`. Refresh tokens are stored in a secure HTTP-only cookie.

## Realtime

WebSocket endpoint:

```txt
GET /api/realtime/rooms/:code
```

See [docs/realtime-protocol.md](docs/realtime-protocol.md) for event envelopes, playback sync rules, and deferrals.

## Scripts

```bash
bun run dev
bun run typecheck
bun test
bun run build
bun run db:generate
bun run db:migrate
```

## Frontend Integration Notes

Set the frontend `VITE_API_URL` to the API origin, for example:

```env
VITE_API_URL=http://localhost:3001
```

The canonical login contract is `email + password`. Existing frontend fields named `username` should be mapped to email or updated before integration.

Room routes should use the public `room.code` value returned by `POST /api/rooms`, not the internal UUID.

## Auth Local Verification

1. Start PostgreSQL and confirm the `DATABASE_URL` in `.env` uses valid credentials.
2. Run `bun run db:migrate`. If this fails with authentication or connection errors, fix `DATABASE_URL` before debugging the frontend.
3. Start the backend with `bun run dev`.
4. Verify `GET http://localhost:3001/api/health`.
5. Verify DB readiness at `GET http://localhost:3001/api/health/db`; missing tables mean migrations have not been applied.
6. Register a user with `POST /api/auth/register`.
7. Login with the same email/password using `POST /api/auth/login`.
8. Confirm the response contains `{ user, accessToken }` and the response sets the `vewave_refresh` HTTP-only cookie.

## CORS And Cookies

`CLIENT_ORIGIN` is a comma-separated exact allowlist. Local defaults are:

```env
CLIENT_ORIGIN=http://localhost:3000,http://localhost:5173
```

Credentialed browser requests cannot use `Access-Control-Allow-Origin: *`, so add each deployed frontend origin explicitly.

Local HTTP development should use:

```env
COOKIE_SECURE=false
```

Cross-site production refresh cookies require HTTPS, `COOKIE_SECURE=true`, and an appropriate `COOKIE_DOMAIN` when sharing cookies across subdomains. Frontend HTTP clients must send credentials; the Vewave frontend Axios clients use `withCredentials: true`.
