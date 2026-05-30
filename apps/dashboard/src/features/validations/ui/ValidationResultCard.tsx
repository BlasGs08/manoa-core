import type { CedulaData } from "../model/use-cedula-validation";
import {
  User,
  MapPin,
  Building2,
  Landmark,
  CheckCircle2,
  Hash,
  DatabaseIcon,
} from "lucide-react";

interface ValidationResultCardProps {
  data: CedulaData;
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Field({ icon, label, value }: FieldProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-b-0">
      <span className="mt-0.5 text-primary shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">
          {label}
        </p>
        <p className="text-sm font-semibold text-foreground truncate">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

export function ValidationResultCard({ data }: ValidationResultCardProps) {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-card shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-primary/5 rounded-t-2xl flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase font-medium tracking-wider mb-0.5">
            Cédula Verificada
          </p>
          <h2 className="text-xl font-bold text-foreground leading-tight">
            {data.fullname}
          </h2>
        </div>
        {data.source === "census" && (
          <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <DatabaseIcon className="h-3 w-3" />
            Padrón comunal
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 py-2 divide-y divide-border">
        <Field
          icon={<Hash className="h-4 w-4" />}
          label="Cédula de Identidad"
          value={`${data.nac}-${data.dni}`}
        />
        <Field
          icon={<User className="h-4 w-4" />}
          label="Nombre(s)"
          value={data.name}
        />
        <Field
          icon={<User className="h-4 w-4" />}
          label="Apellido(s)"
          value={data.lastname}
        />
        <Field
          icon={<MapPin className="h-4 w-4" />}
          label="Estado"
          value={data.state}
        />
        <Field
          icon={<Building2 className="h-4 w-4" />}
          label="Municipio"
          value={data.municipality}
        />
        <Field
          icon={<Building2 className="h-4 w-4" />}
          label="Parroquia"
          value={data.parish}
        />
        <Field
          icon={<Landmark className="h-4 w-4" />}
          label="Centro de Votación"
          value={data.voting}
        />
        <Field
          icon={<MapPin className="h-4 w-4" />}
          label="Dirección del Centro"
          value={data.address}
        />
      </div>
    </div>
  );
}
