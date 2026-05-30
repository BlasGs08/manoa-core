import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, FileText, Mail, MapPin, Phone } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCouncilProfile, useUpdateCouncilProfile } from "@/entities/council-profile";
import { Form } from "@/shared/ui/form";
import { FormInputField, FormTextareaField } from "@/shared/ui/form-fields";
import { FormSubmitButton } from "@/shared/ui/form-submit-button";
import { Skeleton } from "@/shared/ui/skeleton";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  rif: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(30).optional(),
  email: z
    .string()
    .max(100)
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Correo inválido",
    }),
  description: z.string().max(1000).optional(),
});

type FormValues = z.infer<typeof schema>;

export function CouncilProfileForm() {
  const { data, isLoading, isError } = useCouncilProfile();
  const { mutateAsync, isPending } = useUpdateCouncilProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      rif: "",
      address: "",
      phone: "",
      email: "",
      description: "",
    },
  });

  useEffect(() => {
    if (data?.data) {
      form.reset({
        name: data.data.name ?? "",
        rif: data.data.rif ?? "",
        address: data.data.address ?? "",
        phone: data.data.phone ?? "",
        email: data.data.email ?? "",
        description: data.data.description ?? "",
      });
    }
  }, [data, form]);

  const onSubmit = async (values: FormValues) => {
    try {
      await mutateAsync({
        name: values.name,
        rif: values.rif || null,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        description: values.description || null,
      });
      toast.success("Perfil del consejo actualizado");
    } catch {
      toast.error("Error al guardar el perfil");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Error al cargar el perfil. Intenta recargar la página.
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormInputField
            control={form.control}
            name="name"
            label="Nombre del Consejo Comunal"
            icon={Building2}
            placeholder="Ej: Consejo Comunal Manoa"
          />
          <FormInputField
            control={form.control}
            name="rif"
            label="RIF / NIT"
            icon={FileText}
            placeholder="Ej: J-12345678-9"
          />
          <FormInputField
            control={form.control}
            name="address"
            label="Dirección"
            icon={MapPin}
            placeholder="Ej: Urbanización Manoa, Parroquia..."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInputField
              control={form.control}
              name="phone"
              label="Teléfono"
              icon={Phone}
              placeholder="Ej: 0412-1234567"
              type="tel"
            />
            <FormInputField
              control={form.control}
              name="email"
              label="Correo electrónico"
              icon={Mail}
              placeholder="consejo@ejemplo.com"
              type="email"
            />
          </div>
          <FormTextareaField
            control={form.control}
            name="description"
            label="Descripción"
            placeholder="Descripción breve del consejo comunal..."
          />
          <FormSubmitButton isSubmitting={isPending}>
            Guardar cambios
          </FormSubmitButton>
        </form>
      </Form>
    </div>
  );
}
