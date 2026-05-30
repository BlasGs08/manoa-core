import { useState } from "react";
import { env } from "@/env";

export interface CedulaData {
  nac: string;
  dni: string;
  name: string;
  lastname: string;
  fullname: string;
  state: string;
  municipality: string;
  parish: string;
  voting: string;
  address: string;
  source?: "external" | "census";
}

interface SuccessResult {
  state: "success";
  data: CedulaData;
}

interface ErrorResult {
  state: "error";
  message: string;
  status: number;
}

interface IdleResult {
  state: "idle";
}

interface LoadingResult {
  state: "loading";
}

export type ValidationResult =
  | IdleResult
  | LoadingResult
  | SuccessResult
  | ErrorResult;

export function useCedulaValidation() {
  const [result, setResult] = useState<ValidationResult>({ state: "idle" });

  const validate = async (nac: string, cedula: string) => {
    setResult({ state: "loading" });

    try {
      // VITE_API_URL already includes /api (e.g. http://localhost:8787/api)
      // so we only append /validations/... to avoid the double /api/api issue
      const baseUrl =
        env.VITE_API_URL ??
        `${window.location.protocol}//${window.location.hostname}:8787/api`;

      const response = await fetch(
        `${baseUrl}/validations/cedula?nac=${encodeURIComponent(nac)}&cedula=${encodeURIComponent(cedula)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        },
      );

      const json = (await response.json()) as {
        status: number;
        data?: CedulaData;
        message?: string;
      };

      if (response.ok && json.status === 200 && json.data) {
        setResult({ state: "success", data: json.data });
      } else {
        setResult({
          state: "error",
          status: json.status ?? response.status,
          message: json.message ?? "Ocurrió un error inesperado.",
        });
      }
    } catch {
      setResult({
        state: "error",
        status: 0,
        message: "No se pudo conectar con el servidor. Verifica tu conexión.",
      });
    }
  };

  const reset = () => setResult({ state: "idle" });

  return { result, validate, reset };
}
