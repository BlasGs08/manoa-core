import { FileText } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";
import type { StatusStat } from "@/entities/stats";
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendientes", color: "#f59e0b" },
  approved: { label: "Aprobadas", color: "#22c55e" },
  rejected: { label: "Rechazadas", color: "#ef4444" },
};

const chartConfig = {
  pending: { label: "Pendientes", color: "#f59e0b" },
  approved: { label: "Aprobadas", color: "#22c55e" },
  rejected: { label: "Rechazadas", color: "#ef4444" },
};

interface Props {
  total: number;
  byStatus: StatusStat[];
  isLoading: boolean;
}

export function RequestsStatusChart({ total, byStatus, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <Skeleton className="h-52 w-52 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = total > 0;

  const pieData = hasData
    ? byStatus.map((s) => ({
        ...s,
        label: STATUS_CONFIG[s.status]?.label ?? s.status,
        color: STATUS_CONFIG[s.status]?.color ?? "#94a3b8",
      }))
    : [{ status: "empty", count: 1, label: "Sin solicitudes", color: "#e2e8f0" }];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-blue-500/10 p-1.5">
            <FileText className="h-4 w-4 text-blue-500" />
          </div>
          <div>
            <CardTitle>Solicitudes por Estado</CardTitle>
            <CardDescription>
              {hasData ? `${total.toLocaleString("es-VE")} solicitudes en total` : "Sin solicitudes registradas"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-52 w-full">
          <PieChart>
            {hasData && (
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => {
                      const pct = ((Number(value) / total) * 100).toFixed(1);
                      return (
                        <span className="font-semibold">
                          {(value as number).toLocaleString("es-VE")}{" "}
                          <span className="font-normal text-muted-foreground">
                            ({pct}%)
                          </span>
                        </span>
                      );
                    }}
                  />
                }
              />
            )}
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="48%"
              outerRadius="75%"
              paddingAngle={hasData ? 3 : 0}
              dataKey="count"
              nameKey="status"
              strokeWidth={2}
              stroke="hsl(var(--background))"
              animationBegin={0}
              animationDuration={600}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Custom legend with counts */}
        <div className="mt-3 flex flex-col gap-1.5">
          {hasData ? (
            byStatus.map((s) => {
              const cfg = STATUS_CONFIG[s.status];
              const pct = ((s.count / total) * 100).toFixed(1);
              return (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cfg?.color ?? "#94a3b8" }}
                    />
                    <span className="text-muted-foreground">{cfg?.label ?? s.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.count.toLocaleString("es-VE")}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Las solicitudes aparecerán aquí cuando se creen
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
