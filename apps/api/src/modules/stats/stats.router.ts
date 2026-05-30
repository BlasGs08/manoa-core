import { Hono } from "hono";
import { count, desc, eq, sql } from "drizzle-orm";
import type { HonoConfig } from "../../index";
import * as schema from "../../shared/database/schemas";

export const statsRouter = new Hono<HonoConfig>()

  .get("/overview", async (c) => {
    const db = c.get("db");

    const [
      housesTotal,
      familiesTotal,
      citizensTotal,
      housesBySector,
      citizensBySector,
      citizensComposition,
      requestsByStatus,
      requestsByMonth,
      pollsByStatus,
    ] = await Promise.all([
      db.select({ count: count() }).from(schema.houses).get(),
      db.select({ count: count() }).from(schema.families).get(),
      db.select({ count: count() }).from(schema.citizens).get(),
      db
        .select({ sector: schema.houses.sector, count: count() })
        .from(schema.houses)
        .groupBy(schema.houses.sector)
        .orderBy(desc(count()))
        .all(),
      db
        .select({ sector: schema.houses.sector, count: count() })
        .from(schema.citizens)
        .innerJoin(schema.families, eq(schema.citizens.familyId, schema.families.id))
        .innerJoin(schema.houses, eq(schema.families.houseId, schema.houses.id))
        .groupBy(schema.houses.sector)
        .orderBy(desc(count()))
        .all(),
      db
        .select({ isHead: schema.citizens.isHeadOfHousehold, count: count() })
        .from(schema.citizens)
        .groupBy(schema.citizens.isHeadOfHousehold)
        .all(),
      db
        .select({ status: schema.documentRequests.status, count: count() })
        .from(schema.documentRequests)
        .groupBy(schema.documentRequests.status)
        .all(),
      db
        .select({
          month: sql<string>`strftime('%Y-%m', datetime(${schema.documentRequests.createdAt}, 'unixepoch'))`,
          count: count(),
        })
        .from(schema.documentRequests)
        .groupBy(
          sql`strftime('%Y-%m', datetime(${schema.documentRequests.createdAt}, 'unixepoch'))`,
        )
        .orderBy(
          sql`strftime('%Y-%m', datetime(${schema.documentRequests.createdAt}, 'unixepoch'))`,
        )
        .all(),
      db
        .select({ status: schema.polls.status, count: count() })
        .from(schema.polls)
        .groupBy(schema.polls.status)
        .all(),
    ]);

    // Merge houses + citizens by sector
    const sectorMap = new Map<string, { sector: string; houses: number; citizens: number }>();
    for (const h of housesBySector) {
      sectorMap.set(h.sector, { sector: h.sector, houses: h.count, citizens: 0 });
    }
    for (const cit of citizensBySector) {
      const entry = sectorMap.get(cit.sector);
      if (entry) {
        entry.citizens = cit.count;
      } else {
        sectorMap.set(cit.sector, { sector: cit.sector, houses: 0, citizens: cit.count });
      }
    }
    const bySector = Array.from(sectorMap.values()).sort((a, b) => b.citizens - a.citizens);

    const headsCount = citizensComposition.find((item) => item.isHead === true)?.count ?? 0;
    const membersCount = citizensComposition.find((item) => item.isHead !== true)?.count ?? 0;

    const pollOpen = pollsByStatus.find((p) => p.status === "open")?.count ?? 0;
    const pollClosed = pollsByStatus.find((p) => p.status === "closed")?.count ?? 0;

    return c.json({
      census: {
        totals: {
          houses: housesTotal?.count ?? 0,
          families: familiesTotal?.count ?? 0,
          citizens: citizensTotal?.count ?? 0,
        },
        bySector,
        composition: {
          heads: headsCount,
          members: membersCount,
        },
      },
      requests: {
        total: requestsByStatus.reduce((s, r) => s + r.count, 0),
        byStatus: requestsByStatus,
        byMonth: requestsByMonth,
      },
      polls: {
        total: pollOpen + pollClosed,
        open: pollOpen,
        closed: pollClosed,
      },
    });
  });
