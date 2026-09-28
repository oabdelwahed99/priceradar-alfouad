export const SCRAPER_USER_AGENT_TOKEN = "PriceRadar";

interface RobotsRule {
  allow: boolean;
  pattern: string;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelaySeconds: number | null;
}

export interface RobotsPolicy {
  isAllowed(url: string): boolean;
  crawlDelaySeconds: number | null;
}

export function parseRobotsTxt(content: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelaySeconds: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (key === "disallow" && value === "") continue;
      current.rules.push({ allow: key === "allow", pattern: value });
    } else if (key === "crawl-delay") {
      const n = Number.parseFloat(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelaySeconds = n;
    }
  }
  return groups;
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/**
 * Standard robots.txt matching (RFC 9309): the most specific user-agent group applies, the
 * longest matching rule wins, and Allow wins ties.
 */
export function createRobotsPolicy(content: string, agent = SCRAPER_USER_AGENT_TOKEN): RobotsPolicy {
  const groups = parseRobotsTxt(content);
  const token = agent.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const applicable = specific.length > 0 ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = applicable.flatMap((g) => g.rules);
  const crawlDelay = applicable.map((g) => g.crawlDelaySeconds).find((d) => d !== null) ?? null;

  return {
    crawlDelaySeconds: crawlDelay,
    isAllowed(url: string) {
      let path: string;
      try {
        const u = new URL(url);
        path = `${u.pathname}${u.search}`;
      } catch {
        return false;
      }
      let best: RobotsRule | null = null;
      for (const rule of rules) {
        if (!patternToRegex(rule.pattern).test(path)) continue;
        if (
          !best ||
          rule.pattern.length > best.pattern.length ||
          (rule.pattern.length === best.pattern.length && rule.allow)
        ) {
          best = rule;
        }
      }
      return best ? best.allow : true;
    },
  };
}

const ALLOW_ALL: RobotsPolicy = { isAllowed: () => true, crawlDelaySeconds: null };
const CACHE_TTL_MS = 60 * 60 * 1000;
const robotsCache = new Map<string, { policy: RobotsPolicy; expiresAt: number }>();

/**
 * Fetches and caches robots.txt per origin. Missing robots.txt (4xx) allows crawling; server
 * errors are treated conservatively as "allow" for a single user-initiated page view but are not cached long.
 */
export async function getRobotsPolicy(url: string, timeoutMs = 5_000): Promise<RobotsPolicy> {
  const origin = new URL(url).origin;
  const cached = robotsCache.get(origin);
  if (cached && cached.expiresAt > Date.now()) return cached.policy;

  let policy = ALLOW_ALL;
  let ttl = CACHE_TTL_MS;
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": `${SCRAPER_USER_AGENT_TOKEN}/0.1` },
      redirect: "follow",
    });
    if (res.ok) {
      const text = await res.text();
      policy = createRobotsPolicy(text.slice(0, 500_000));
    } else if (res.status >= 500) {
      ttl = 5 * 60 * 1000;
    }
  } catch {
    ttl = 5 * 60 * 1000;
  }
  robotsCache.set(origin, { policy, expiresAt: Date.now() + ttl });
  return policy;
}

export function clearRobotsCache(): void {
  robotsCache.clear();
}
