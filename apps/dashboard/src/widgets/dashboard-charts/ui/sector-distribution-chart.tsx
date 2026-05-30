import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";
import type { SectorStat } from "@/entities/stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/chart";
import { Skeleton } from "@/shared/ui/skeleton";

const chartConfig = {
  houses: { label: "Viviendas", color: "#3b82f6" },
  citizens: { label: "Habitantes", color: "#8b5cf6" },
};

// Gradient palette cycling through blue→violet hues per sector
const SECTOR_COLORS = [
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
  "#0ea5e9", "#14b8a6", "#10b981", "#22c55e", "#84cc16",
  "#eab308", "#f97316",
];

interface Props {
  data: SectorStat[];
  isLoading: boolean;
}

export function SectorDistributionChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  const top = data.slice(0, 14);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Distribución por Manzana</CardTitle>
        <CardDescription>
          Viviendas y habitantes por manzana · top{" "}
          {Math.min(14, data.length)} de {data.length}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-80 w-full">
          <BarChart
            data={top}
            layout="vertical"
            margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
            barCategoryGap="20%"
            barGap={3}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              dataKey="sector"
              type="category"
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--foreground))" }}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted))", radius: 4 }}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <span className="font-semibold">
                      {(value as number).toLocaleString("es-VE")}{" "}
                      <span className="font-normal text-muted-foreground">
                        {name === "houses" ? "viviendas" : "habitantes"}
                      </span>
                    </span>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="houses" name="houses" radius={[0, 4, 4, 0]} maxBarSize={14}>
              {top.map((_, i) => (
                <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} opacity={0.65} />
              ))}
            </Bar>
            <Bar dataKey="citizens" name="citizens" radius={[0, 4, 4, 0]} maxBarSize={14}>
              {top.map((_, i) => (
                <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
              ))}
              <LabelList
                dataKey="citizens"
                position="right"
                style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
