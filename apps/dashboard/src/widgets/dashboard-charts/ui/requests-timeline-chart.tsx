import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { MonthStat } from "@/entities/stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/chart";
import { Skeleton } from "@/shared/ui/skeleton";

const chartConfig = {
  count: { label: "Solicitudes", color: "#3b82f6" },
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

function getLast12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
  }
  return months;
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  return `${MONTH_LABELS[month] ?? month} ${year?.slice(2)}`;
}

interface Props {
  byMonth: MonthStat[];
  total: number;
  isLoading: boolean;
}

export function RequestsTimelineChart({ byMonth, total, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    );
  }

  const monthMap = new Map(byMonth.map((m) => [m.month, m.count]));
  const last12 = getLast12Months();
  const chartData = last12.map((ym) => ({
    month: ym,
    label: formatMonthLabel(ym),
    count: monthMap.get(ym) ?? 0,
  }));

  const maxVal = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-500/10 p-1.5">
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle>Evolución de Solicitudes</CardTitle>
              <CardDescription>
                Solicitudes de documentos en los últimos 12 meses
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{total.toLocaleString("es-VE")}</p>
            <p className="text-xs text-muted-foreground">total histórico</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              interval={1}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={[0, maxVal + 1]}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={28}
            />
            <ChartTooltip
              cursor={{ stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="font-semibold">
                      {(value as number).toLocaleString("es-VE")}{" "}
                      <span className="font-normal text-muted-foreground">solicitudes</span>
                    </span>
                  )}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.month ?? ""}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#requestsGradient)"
              dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
