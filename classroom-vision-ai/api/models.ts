import type { ExternalModel } from "../src/presentation/types.js";

type RequestLike = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};
type ResponseLike = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(value: unknown): void };
};
type ModelRecord = {
  uid?: unknown;
  name?: unknown;
  isAgeRestricted?: boolean;
  animationCount?: number;
  license?: { label?: unknown };
  user?: { displayName?: unknown; username?: unknown; profileUrl?: unknown };
  thumbnails?: { images?: Array<{ width?: number; url?: unknown }> };
};
const cache = new Map<string, { expires: number; models: ExternalModel[] }>();
const clean = (value: unknown, limit = 120) =>
  typeof value === "string"
    ? value.replace(/[\u0000-\u001f]/g, "").slice(0, limit)
    : "";
function trustedUrl(value: unknown, host: string): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export async function searchSketchfabModels(
  input: string,
): Promise<ExternalModel[]> {
  const query = input.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 100)
    throw new Error("Search needs between 2 and 100 characters.");
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.models;
  const url = new URL("https://api.sketchfab.com/v3/search");
  url.searchParams.set("type", "models");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "12");
  url.searchParams.set("downloadable", "true");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error("Sketchfab search is temporarily unavailable.");
    const payload = (await response.json()) as { results?: ModelRecord[] };
    if (!Array.isArray(payload.results))
      throw new Error("Sketchfab returned an invalid response.");
    const models = payload.results
      .slice(0, 12)
      .flatMap((item): ExternalModel[] => {
        const uid = clean(item.uid, 40);
        if (!/^[a-f0-9]{32}$/i.test(uid) || item.isAgeRestricted) return [];
        const images = [...(item.thumbnails?.images ?? [])].sort(
          (a, b) => (a.width ?? 0) - (b.width ?? 0),
        );
        const image =
          images.find((entry) => (entry.width ?? 0) >= 480) ?? images.at(-1);
        return [
          {
            uid,
            title: clean(item.name) || "Untitled model",
            author:
              clean(item.user?.displayName || item.user?.username) ||
              "Sketchfab creator",
            authorUrl:
              trustedUrl(item.user?.profileUrl, "sketchfab.com") ||
              "https://sketchfab.com",
            url: `https://sketchfab.com/models/${uid}`,
            thumbnail: trustedUrl(image?.url, "media.sketchfab.com"),
            license: clean(item.license?.label) || "License not listed",
            animated: Number(item.animationCount) > 0,
          },
        ];
      });
    if (cache.size >= 50) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { models, expires: Date.now() + 5 * 60 * 1000 });
    return models;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(
  request: RequestLike,
  response: ResponseLike,
) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Use GET to search models." });
    return;
  }
  const query =
    request.query?.q ??
    new URL(request.url ?? "/", "http://localhost").searchParams.get("q") ??
    "";
  if (
    typeof query !== "string" ||
    query.trim().length < 2 ||
    query.trim().length > 100
  ) {
    response
      .status(400)
      .json({ error: "Search needs between 2 and 100 characters." });
    return;
  }
  try {
    const models = await searchSketchfabModels(query);
    response.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600",
    );
    response.status(200).json({ models });
  } catch {
    response.setHeader("Cache-Control", "no-store");
    response
      .status(503)
      .json({
        error:
          "Live model search is unavailable right now. You can still open the featured engine.",
      });
  }
}
