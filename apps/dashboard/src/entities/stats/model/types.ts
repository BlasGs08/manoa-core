export interface SectorStat {
  sector: string;
  houses: number;
  citizens: number;
}

export interface StatusStat {
  status: string;
  count: number;
}

export interface MonthStat {
  month: string;
  count: number;
}

export interface StatsOverview {
  census: {
    totals: {
      houses: number;
      families: number;
      citizens: number;
    };
    bySector: SectorStat[];
    composition: {
      heads: number;
      members: number;
    };
  };
  requests: {
    total: number;
    byStatus: StatusStat[];
    byMonth: MonthStat[];
  };
  polls: {
    total: number;
    open: number;
    closed: number;
  };
}
