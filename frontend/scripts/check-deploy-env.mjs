// Vite embeds this public URL at build time. A relative /api has no backend on Vercel.
const value = process.env.VITE_API_BASE_URL;
try {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname.replace(/\/$/, "") !== "/api" ||
    url.search ||
    url.hash ||
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new Error();
} catch {
  console.error(
    "Set VITE_API_BASE_URL to your HTTPS backend URL ending in /api before deploying to Vercel.",
  );
  process.exit(1);
}
