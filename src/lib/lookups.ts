// Helpers for Bundle 1 dual-write.
// Each helper takes a free-text name and returns the matching master-row id, or null.
// Lookups go through a per-request memo cache so the same name in a payload only hits the DB once.
// We do NOT auto-create master rows here. If a name does not exist in the master, we return null
// and rely on the string column as the source of truth during the dual-write phase. Auto-create
// would let typos pollute the master and undermine the point of moving to FKs.

import { db } from "@/lib/db";

type Cache = Map<string, string | null>;

function makeCache(): Cache {
  return new Map();
}

async function resolveByName(
  cache: Cache,
  prefix: string,
  raw: string | null | undefined,
  fetcher: (name: string) => Promise<{ id: string } | null>,
): Promise<string | null> {
  if (raw == null) return null;
  const name = raw.trim();
  if (!name) return null;
  const key = prefix + ":" + name;
  if (cache.has(key)) return cache.get(key) ?? null;
  const row = await fetcher(name);
  const id = row?.id ?? null;
  cache.set(key, id);
  return id;
}

export function createLookupResolver() {
  const cache = makeCache();

  return {
    colourId: (name: string | null | undefined) =>
      resolveByName(cache, "colour", name, (n) =>
        db.colour.findUnique({ where: { name: n }, select: { id: true } }),
      ),
    productTypeId: (name: string | null | undefined) =>
      resolveByName(cache, "productType", name, (n) =>
        db.productType.findUnique({ where: { name: n }, select: { id: true } }),
      ),
    garmentingLocationId: (name: string | null | undefined) =>
      resolveByName(cache, "garmentingLocation", name, (n) =>
        db.garmentingLocation.findUnique({ where: { name: n }, select: { id: true } }),
      ),
    /**
     * Resolve an array of colour names to their ids. Names with no matching master row are dropped.
     * Returns deduped ids preserving first-seen order.
     */
    colourIds: async (names: readonly (string | null | undefined)[]): Promise<string[]> => {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const n of names) {
        const id = await resolveByName(cache, "colour", n, (nm) =>
          db.colour.findUnique({ where: { name: nm }, select: { id: true } }),
        );
        if (id && !seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
      return out;
    },
  };
}

export type LookupResolver = ReturnType<typeof createLookupResolver>;
