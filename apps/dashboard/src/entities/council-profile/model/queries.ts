import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/api/api-client";
import type { CouncilProfile, UpdateCouncilProfilePayload } from "./types";

export const councilProfileKeys = {
  all: ["council-profile"] as const,
};

export const useCouncilProfile = () =>
  useQuery({
    queryKey: councilProfileKeys.all,
    queryFn: () =>
      api.get("settings/profile").json<{ data: CouncilProfile }>(),
  });

export const useUpdateCouncilProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCouncilProfilePayload) =>
      api
        .put("settings/profile", { json: data })
        .json<{ data: CouncilProfile }>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: councilProfileKeys.all });
    },
  });
};
