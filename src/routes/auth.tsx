import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lock, User } from "lucide-react";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setTimeout(() => {
      if (login(u, p)) {
        toast.success("Welcome back, Sai 👋");
        nav({ to: "/dashboard" });
      } else {
        setErr("Invalid Username or Password");
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="glass w-full max-w-md rounded-3xl p-8"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">LifeOS</h1>
            <p className="text-xs text-muted-foreground">Your Personal Operating System</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="u">Username</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="u" autoFocus value={u} onChange={(e) => setU(e.target.value)} placeholder="admin" className="pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="••••••••" className="pl-9" />
            </div>
          </div>
          {err && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-destructive">
              {err}
            </motion.p>
          )}
          <Button disabled={loading} className="w-full" size="lg">
            {loading ? "Signing in…" : "Enter LifeOS"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
