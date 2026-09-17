import index from "./index.html";
import editor from "./editor.html";

const port = Number(Bun.env.PORT ?? 3000);
const assetsRoot = new URL("./assets/", import.meta.url);

async function assetResponse(relPath: string) {
  if (!relPath || relPath.includes("\0") || relPath.includes("..") || relPath.startsWith("/") || relPath.includes("\\")) {
    return new Response("Not Found", { status: 404 });
  }
  const file = Bun.file(new URL(relPath, assetsRoot));
  if (!(await file.exists())) return new Response("Not Found", { status: 404 });
  const headers: Record<string, string> = { "Cache-Control": "public, max-age=31536000" };
  if (relPath.endsWith(".ttf")) {
    headers["Content-Type"] = "font/ttf";
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return new Response(file, { headers });
}

Bun.serve({
  port,
  routes: {
    "/": index,
    "/editor": editor,
    "/assets/*": (req) => {
      const relPath = decodeURIComponent(new URL(req.url).pathname.slice("/assets/".length));
      return assetResponse(relPath);
    },
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
console.log(`Map editor: http://localhost:${port}/editor`);
