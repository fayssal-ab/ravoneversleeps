// Netlify runs this on published deploys once a day (04:00 UTC): closes
// decided Discord tickets (see lib/tickets.ts).
export const config = { schedule: "0 4 * * *" };

export default async function discordCleanup() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) throw new Error("URL and CRON_SECRET are required for the Discord cleanup");
  const response = await fetch(new URL("/api/cron/discord", base), {
    method: "POST", headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(27000),
  });
  if (!response.ok) throw new Error(`Discord cleanup failed: HTTP ${response.status}`);
  console.log("Discord cleanup completed", await response.json());
}
