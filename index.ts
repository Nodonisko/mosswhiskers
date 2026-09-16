import index from "./index.html";

const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  routes: {
    "/": index,
    "/assets/meadow-texture.png": new Response(
      Bun.file(new URL("./assets/meadow-texture.png", import.meta.url)),
    ),
    "/assets/background.mp3": new Response(
      Bun.file(new URL("./assets/background.mp3", import.meta.url)),
      { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" } },
    ),
    "/assets/PressStart2P-Regular.ttf": new Response(
      Bun.file(new URL("./assets/PressStart2P-Regular.ttf", import.meta.url)),
      { headers: { "Content-Type": "font/ttf", "Cache-Control": "public, max-age=31536000", "Access-Control-Allow-Origin": "*" } },
    ),
    "/assets/apple-touch-icon.png": new Response(
      Bun.file(new URL("./assets/apple-touch-icon.png", import.meta.url)),
      { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000" } },
    ),
    "/assets/favicon-32.png": new Response(
      Bun.file(new URL("./assets/favicon-32.png", import.meta.url)),
      { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000" } },
    ),
    "/assets/icon-192.png": new Response(
      Bun.file(new URL("./assets/icon-192.png", import.meta.url)),
      { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000" } },
    ),
    "/assets/icon-512.png": new Response(
      Bun.file(new URL("./assets/icon-512.png", import.meta.url)),
      { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000" } },
    ),
    "/favicon.svg": new Response(
      Bun.file(new URL("./favicon.svg", import.meta.url)),
      { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000" } },
    ),
    "/manifest.webmanifest": new Response(
      Bun.file(new URL("./manifest.webmanifest", import.meta.url)),
      { headers: { "Content-Type": "application/manifest+json" } },
    ),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Mosswhiskers Meadow is running at http://localhost:${port}`);
