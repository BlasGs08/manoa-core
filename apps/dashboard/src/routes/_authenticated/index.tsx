import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  FileTextIcon,
  HomeIcon,
  MessageSquareIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
  VoteIcon,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useStatsOverview } from "@/entities/stats";
import {
  HouseholdCompositionChart,
  RequestsStatusChart,
  RequestsTimelineChart,
  SectorDistributionChart,
} from "@/widgets/dashboard-charts";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export const Route = createFileRoute("/_authenticated/")({
  component: RouteComponent,
});

const STAT_CARDS = [
  {
    key: "houses" as const,
    label: "Viviendas",
    icon: HomeIcon,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    key: "families" as const,
    label: "Familias",
    icon: UsersIcon,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    key: "citizens" as const,
    label: "Habitantes",
    icon: UserIcon,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    key: "requests" as const,
    label: "Solicitudes",
    icon: FileTextIcon,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    key: "polls" as const,
    label: "Proyectos",
    icon: VoteIcon,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
] as const;

function RouteComponent() {
  const { data: session } = authClient.useSession();
  const { data: stats, isLoading } = useStatsOverview();

  const firstName = session?.user?.name?.split(" ")[0] ?? "Admin";

  const statValues: Record<string, number | undefined> = {
    houses: stats?.census.totals.houses,
    families: stats?.census.totals.families,
    citizens: stats?.census.totals.citizens,
    requests: stats?.requests.total,
    polls: stats?.polls.total,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Bienvenido, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Panel de control · Consejo Comunal de Manoa
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, bg, border }) => (
          <Card key={key} className={`border ${border}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {label}
              </CardTitle>
              <div className={`rounded-md p-1.5 ${bg}`}>
                <Icon className={`size-3.5 ${color}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold tracking-tight">
                  {(statValues[key] ?? 0).toLocaleString("es-VE")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1: sector distribution (large) + household composition */}
      <div className="grid grid-cols-3 gap-4">
        <SectorDistributionChart
          data={stats?.census.bySector ?? []}
          isLoading={isLoading}
        />
        <HouseholdCompositionChart
          composition={stats?.census.composition ?? { heads: 0, members: 0 }}
          isLoading={isLoading}
        />
      </div>

      {/* Charts row 2: requests status + timeline */}
      <div className="grid grid-cols-3 gap-4">
        <RequestsStatusChart
          total={stats?.requests.total ?? 0}
          byStatus={stats?.requests.byStatus ?? []}
          isLoading={isLoading}
        />
        <RequestsTimelineChart
          byMonth={stats?.requests.byMonth ?? []}
          total={stats?.requests.total ?? 0}
          isLoading={isLoading}
        />
      </div>

      {/* AI assistant card */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3">
              <SparklesIcon className="size-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Asistente Manoa IA</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Consulta estadísticas, información del censo o gestiona trámites
                usando lenguaje natural.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <Link to="/ai-assistant">
              <MessageSquareIcon className="size-4" />
              Abrir asistente
              <ArrowRightIcon className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
