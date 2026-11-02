import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function localPresentationApi(): Plugin {
  return {
    name: "vision-local-presentation-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        if (!["/api/assistant", "/api/models"].includes(url.pathname))
          return next();
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (Buffer.byteLength(body) > 131072) {
            res.statusCode = 413;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Request is too large." }));
            return;
          }
        }
        const response = {
          setHeader: (name: string, value: string) =>
            res.setHeader(name, value),
          status(code: number) {
            res.statusCode = code;
            return {
              json(value: unknown) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(value));
              },
              end(value?: string) {
                res.end(value);
              },
            };
          },
        };
        try {
          const handler = await server.ssrLoadModule(url.pathname + ".ts");
          await handler.default(
            {
              method: req.method,
              body: body || undefined,
              url: req.url,
              headers: req.headers,
              socket: req.socket,
              query: Object.fromEntries(url.searchParams),
            },
            response,
          );
        } catch {
          if (!res.writableEnded)
            response
              .status(500)
              .json({
                error: "The local assistant is unavailable. Please retry.",
              });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Unprefixed secrets are read by the local server, never bundled into the client.
  for (const key of [
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "OPENAI_ASSISTANT_MODEL",
    "VISION_AI_ENABLED",
  ]) {
    if (!process.env[key] && env[key]) process.env[key] = env[key];
  }
  return {
    plugins: [react(), localPresentationApi()],
    server: {
      port: 5173,
    },
    preview: {
      port: 4173,
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            three: ["three", "@react-three/fiber"],
            vision: ["@mediapipe/tasks-vision"],
          },
        },
      },
    },
  };
});
