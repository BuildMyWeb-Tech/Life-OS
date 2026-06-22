import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const authed = localStorage.getItem("lifeos:auth") === "1";
    throw redirect({ to: authed ? "/dashboard" : "/auth" });
  },
  component: () => null,
});
