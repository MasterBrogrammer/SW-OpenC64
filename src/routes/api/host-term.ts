import { createFileRoute } from "@tanstack/react-router";
import { handleHostTerm } from "@/lib/host-shell.server";

export const Route = createFileRoute("/api/host-term")({
  server: {
    handlers: {
      POST: async ({ request }) => handleHostTerm(request),
    },
  },
});
