import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/api-client";
import type { StatsOverview } from "./types";

export const statsKeys = {
  all: ["stats"] as const,
  overview: () => [...statsKeys.all, "overview"] as const,
};

export const useStatsOverview = () =>
  useQuery({
    queryKey: statsKeys.overview(),
    queryFn: () => api.get("stats/overview").json<StatsOverview>(),
    staleTime: 60_000,
  });
