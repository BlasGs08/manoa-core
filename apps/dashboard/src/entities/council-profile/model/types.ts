export interface CouncilProfile {
  id: string;
  name: string;
  rif: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  updatedAt: string | number | null;
}

export interface UpdateCouncilProfilePayload {
  name: string;
  rif?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
}
