import index from "./index.html";

const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  routes: {
    "/": index,
    "/assets/meadow-texture.png": new Response(
      Bun.file(new URL("./assets/meadow-texture.png", import.meta.url)),
    ),
    "/assets/PressStart2P-Regular.ttf": new Response(
      Bun.file(new URL("./assets/PressStart2P-Regular.ttf", import.meta.url)),
      { headers: { "Content-Type": "font/ttf", "Cache-Control": "public, max-age=31536000" } },
    ),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log(`Mosswhisker Hollow is running at http://localhost:${port}`);
