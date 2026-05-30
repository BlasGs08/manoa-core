import { Users } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import type { StatsOverview } from "@/entities/stats";
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
  heads: { label: "Jefes de Hogar", color: "#f59e0b" },
  members: { label: "Otros Miembros", color: "#8b5cf6" },
};

interface Props {
  composition: StatsOverview["census"]["composition"];
  isLoading: boolean;
}

export function HouseholdCompositionChart({ composition, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <Skeleton className="h-52 w-52 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const total = composition.heads + composition.members;
  const headsPercent = total > 0 ? ((composition.heads / total) * 100).toFixed(1) : "0";

  const pieData = [
    { name: "heads", value: composition.heads, label: "Jefes de Hogar" },
    { name: "members", value: composition.members, label: "Otros Miembros" },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-amber-500/10 p-1.5">
            <Users className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <CardTitle>Composición del Hogar</CardTitle>
            <CardDescription>
              Jefes de hogar vs. otros miembros
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="font-semibold">
                      {(value as number).toLocaleString("es-VE")}{" "}
                      <span className="font-normal text-muted-foreground">personas</span>
                    </span>
                  )}
                />
              }
            />
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              strokeWidth={2}
              stroke="hsl(var(--background))"
            >
              <Cell fill="#f59e0b" />
              <Cell fill="#8b5cf6" />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              verticalAlign="bottom"
            />
          </PieChart>
        </ChartContainer>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-sm">
          <span className="font-semibold text-amber-500">{headsPercent}%</span>
          <span className="text-muted-foreground">son jefes de hogar</span>
        </div>
      </CardContent>
    </Card>
  );
}
