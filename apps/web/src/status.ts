import { type AgentStatus, BunnyAgentClient } from "@bunny.net/agent-core";
import { useQuery } from "@tanstack/react-query";

const client = new BunnyAgentClient();

export function useAgentStatus() {
  return useQuery<AgentStatus>({
    queryKey: ["agent-status"],
    queryFn: () => client.status(),
    staleTime: 60_000,
  });
}
