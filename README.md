# RAVONEVERSLEEPS

Rewards hub for the Kick streamer **Ravo** (kick.com/ravoneversleeps). Viewers
sign up on Qzino with code **RAVO50**, play, and compete here. The site is not
a casino and takes no deposits.

## Pages

Navigation: Home · Leaderboard · **Rewards** (Store, Challenges, VIP Transfer,
Raffles) · **Stream** (Watch live, Bonus hunts, Tournaments).

- **Home**: mascot hero, Qzino bonus card, leaderboard band, Kick stream, VIP Transfer teaser, store preview.
- **Leaderboard**: Q-boards points board (podium, countdown, search, rules) with a monthly archive.
- **Store**: small rewards (Qzino tips, bonus buy splits) bought with points.
- **Challenges**: "first to hit Nx on a slot wins $X"; claiming opens a Discord proof ticket.
- **VIP Transfer**: Qzino VIP benefits and an application form reviewed in a Discord ticket.
- **Raffles**: points tickets with a provably fair draw that viewers can re-check in the browser.
- **Stream**: Kick player when live (animated pixel banner when offline) and the weekly schedule.
- **Bonus hunts**: live hunt tracker with stats, biggest multi and break-even multi.
- **Tournaments**: solo (1v1) or duo (2v2) knockout from `!join` in Kick chat; tall OBS overlay.
- **Account**: Discord (main) / Kick sign-in, Qzino username + verification, points history.
- Not in the menu: **Milestones** (`/milestones`, monthly points milestones) and **Ranks** (`/ranks`).

Admin lives at **`/login`**. Credentials are `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
Every admin change is written to the audit log.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · motion · MySQL 8
(`mysql2`, raw SQL migrations) · Zod · decimal.js for money.

Fonts come from Google via `next/font`:

| Font | Used for |
| --- | --- |
| Metal Mania | Display |
| Chakra Petch | Headings |
| Sora | Body text |
| JetBrains Mono | Numbers |
| Pixelify Sans | Small labels |

## Getting started

```bash
cp .env.example .env.local   # DB_*, ADMIN_*, SESSION_SECRET, …
npm install
npm run migrate              # creates the DB if allowed + applies db/migrations/*
npm run seed                 # ranks, store rewards, starter milestones
npm run dev
```

Migrations marked `-- migrate: tolerate-existing` can also be applied by the
app itself on first use (new columns/tables), so a deploy works before
`npm run migrate`; running the migration afterwards skips what already exists.

On Aiven (free tier, low connection cap) every DB session sets a 90 s
`wait_timeout` so frozen serverless instances can't hold connections.

## Leaderboard (Q-boards)

The public leaderboard syncs from Q-boards for **ravoneversleeps** (public read
endpoints, no casino key; Q-boards **points**, never dollar wagers). Each
event (month) is stored separately: the running one refreshes on every sync,
a finished one gets a final sync after its end, and finished months stay
browsable at `/leaderboard?e=<event>`. The next month shows up automatically
as soon as Ravo's next event starts on Q-boards (the site can't create it).

On Netlify, `netlify/functions/sync-leaderboard.mjs` calls the protected sync
route every 8 hours (00:00, 08:00, 16:00 UTC). Set a strong `CRON_SECRET`
(Functions scope too). Other hosts can call `/api/cron/leaderboard` with
`Authorization: Bearer <CRON_SECRET>`. Failed syncs keep the last snapshot; the
page flags a delay after 9 hours.

Milestones use the viewer's points in the running event (matched by Qzino
username), one claim per milestone per event month.

## Kick (tournament `!join`)

Kick app (`KICK_CLIENT_ID` / `KICK_CLIENT_SECRET`, redirect
`https://<site>/api/auth/kick/callback`, scope `events:subscribe`, webhook URL
`https://<site>/api/kick/webhook`). Opening registration subscribes Ravo's
channel to `chat.message.sent`; every `!join` is recorded server-side.

## Discord (sign-in, verification and tickets)

One Discord app does both sign-in and the ticket bot:

1. **OAuth2**: copy Client ID / Secret, add the redirect
   `https://<site>/api/auth/discord/callback`. Sign-in asks `identify guilds.join`
   (the viewer is added to Ravo's server).
2. **Bot**: Public Bot off, no privileged intents, copy the token.
3. Invite the bot (scope `bot`) with View Channels, Manage Channels, Manage
   Roles, Send Messages, Embed Links, Attach Files, Read Message History and
   Create Instant Invite.
4. In the server: a private `Tickets` category and a `Staff` role; copy their IDs
   and the server ID (Developer Mode).
5. Env: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`,
   `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_TICKET_CATEGORY_ID`,
   `DISCORD_STAFF_ROLE_ID`.

The bot opens private channels (viewer + Staff + bot) for: Qzino username
verification (Admin → Users: Verify/Reject), challenge claims (proof; Admin →
Challenges) and VIP Transfer applications (Admin → VIP Transfer). Decisions are
posted in the ticket. Without the bot variables everything still works, just
without tickets.

## Points

Points are only added by the team (Admin → Users & points, one by one or as a
bulk drop); there is no automatic earning. They are spent in the store (a
rejected redemption is refunded). Every change is in the points ledger.

## Tests

```bash
npx tsx --test lib/*.test.ts
# end-to-end, against a throwaway database only:
DB_NAME=ravo_test npm run migrate
DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test --test-concurrency=1 tests/e2e/*.test.ts
```

If styles stop updating in dev, stop the server and delete `.next/`.
