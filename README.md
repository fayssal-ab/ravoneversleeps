# RAVONEVERSLEEPS

Rewards hub for the Kick streamer **Ravo** (kick.com/ravoneversleeps). Viewers
sign up on Qzino with code **RAVO50**, play, and compete here. The site is not
a casino and takes no deposits.

## Pages

Navigation: Home · Leaderboard · **Rewards** (Store, Challenges) ·
**Stream** (Watch live, Clips, Bonus hunts, Tournaments).
Qzino is the only partner (Flush was removed; its DB columns are left unused).
Raffles and ranks were removed (their tables stay in the DB).
Milestones were removed too; migration 0017 drops their tables.

- **Home**: playable RAVO slot hero, Kick clips strip, leaderboard (top-3 prizes set in admin), Qzino card, stream, VIP teaser.
- **Clips**: Ravo's Kick clips, played on the site (hls.js).
- **Leaderboard**: the QHub Open Leaderboard (q-hub.tv): podium, seats, prize per seat, search, rules. Read from the q-hub.tv page itself (no API), cached 5 minutes (`lib/qhub.ts`).
- **Store**: rewards paid in QHub Points (tips, bonus buy, blackjack hand, keno). "Redeem" takes the QHub username + a screenshot of the Points and opens a private Discord ticket with the proof; staff mark it Paid / Reject in Admin → Store (prices editable there). Needs Discord and a verified Qzino username. 3D hero scene in `components/three/Store3DScene.tsx`.
- **Challenges**: "first to hit Nx on a slot wins $X"; claiming opens a Discord proof ticket.
- **VIP Transfer**: Qzino VIP benefits and an application form reviewed in a Discord ticket.
- **Stream**: Kick player when live (Ravo's pug film when offline) and the weekly schedule.
- **Bonus hunts**: live hunt tracker with stats, biggest multi and break-even multi.
- **Tournaments**: solo (1v1) or duo (2v2) knockout from `!join` in Kick chat; tall OBS overlay.
- **Account**: Discord-only sign-in, Kick linked from the account page, Qzino username + ownership verification.

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
npm run seed                 # ranks, store rewards
npm run dev
```

Migrations marked `-- migrate: tolerate-existing` can also be applied by the
app itself on first use (new columns/tables), so a deploy works before
`npm run migrate`; running the migration afterwards skips what already exists.

On Aiven (free tier, low connection cap) every DB session sets a 90 s
`wait_timeout` so frozen serverless instances can't hold connections.

## Leaderboard (QHub)

`/leaderboard` mirrors the QHub Open Leaderboard (q-hub.tv/leaderboard). QHub
has no public API: `lib/qhub.ts` reads the board from the page's server
payload, validates it and caches it 5 minutes (last good board kept if QHub
is down). Seat prizes are in `QHUB_SEAT_PRIZES`. Nothing is stored in the DB.
The old Q-boards sync (tables, cron route, Netlify function) is gone;
migration 0023 drops its tables.

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

## Tests

```bash
npx tsx --test lib/*.test.ts
# end-to-end, against a throwaway database only:
DB_NAME=ravo_test npm run migrate
DB_NAME=ravo_test node --env-file-if-exists=.env.local --conditions=react-server --import tsx --test --test-concurrency=1 tests/e2e/*.test.ts
```

If styles stop updating in dev, stop the server and delete `.next/`.
