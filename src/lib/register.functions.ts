import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be 32 characters or fewer")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, and _ . - are allowed"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/** Every registered user gets a synthetic email in this namespace so RLS
 * (auth.uid() = user_id) can scope their data — no real inbox is used. */
function emailForUsername(username: string) {
  return `${username.toLowerCase().trim()}@user.mylife-monitor.local`;
}

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = emailForUsername(data.username);

    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    const taken = users.users.some((u) => u.email?.toLowerCase() === email);
    if (taken) {
      return { ok: false as const, error: "That username is already taken." };
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, app: "lifeos" },
    });
    if (error || !created.user) {
      return { ok: false as const, error: error?.message ?? "Could not create account." };
    }

    return { ok: true as const, email, userId: created.user.id };
  });