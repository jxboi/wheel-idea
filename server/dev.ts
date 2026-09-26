import { createServer } from "node:http";
import { loadEnv, createServer as createViteServer } from "vite";
import handler from "../api/generate.js";
import type { ApiRequest, ApiResponse } from "./http";
Object.assign(process.env, loadEnv("development", process.cwd(), ""));
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});
const server = createServer(async (req, res) => {
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || "")) {
    res.writeHead(403);
    res.end("Orbit local development accepts localhost requests only.");
    return;
  }
  if (req.url?.split("?")[0] === "/api/generate") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (Buffer.byteLength(body) > 3_500_000) {
        res.writeHead(413);
        res.end(
          JSON.stringify({ error: "Your inspiration images are too large." }),
        );
        return;
      }
    }
    try {
      (req as ApiRequest).body = JSON.parse(body || "{}");
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid request." }));
      return;
    }
    const response = res as ApiResponse;
    response.status = (code: number) => {
      res.statusCode = code;
      return response;
    };
    response.json = (value: unknown) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(value));
      return response;
    };
    await handler(req as ApiRequest, response);
    return;
  }
  vite.middlewares(req, res);
});
const port = Number(process.env.PORT) || 5173;
server.listen(port, "127.0.0.1", () =>
  console.log(`Orbit is ready at http://127.0.0.1:${port}`),
);
