import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ADMIN_EMAIL = "lifeos-admin@mylife-monitor.local";
const INTERNAL_ADMIN_PASSWORD = "LifeOS-Admin-Persist-2026!9vK#rT";
const LEGACY_SENTINEL_USER_ID = "00000000-0000-0000-0000-000000000000";

const inputSchema = z.object({
  username: z.string(),
  password: z.string(),
});

const expectedUser = () => process.env.VITE_ADMIN_USERNAME || "admin";
const expectedPass = () => process.env.VITE_ADMIN_PASSWORD || "admin@2026";

type UserScore = {
  categories: number;
  habits: number;
  habitLogs: number;
  routineItems: number;
  routineLogs: number;
};

const emptyScore = (): UserScore => ({
  categories: 0,
  habits: 0,
  habitLogs: 0,
  routineItems: 0,
  routineLogs: 0,
});

function addScore(scores: Map<string, UserScore>, userId: string | null, key: keyof UserScore) {
  if (!userId) return;
  const score = scores.get(userId) ?? emptyScore();
  score[key] += 1;
  scores.set(userId, score);
}

function totalScore(score: UserScore) {
  return (
    score.categories * 8 +
    score.habits * 10 +
    score.habitLogs * 2 +
    score.routineItems * 8 +
    score.routineLogs * 2
  );
}

export const ensureAdminAccount = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.username !== expectedUser() || data.password !== expectedPass()) {
      return { ok: false as const, email: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) throw listError;

    let adminUser = users.users.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL);
    if (!adminUser) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: INTERNAL_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: expectedUser(), app: "lifeos" },
      });
      if (error) throw error;
      adminUser = created.user;
    } else {
      const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(adminUser.id, {
        password: INTERNAL_ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: expectedUser(), app: "lifeos" },
      });
      if (error) throw error;
      adminUser = updated.user;
    }

    const scores = new Map<string, UserScore>();
    const [categories, habits, habitLogs, routineItems, routineLogs] = await Promise.all([
      supabaseAdmin.from("lifeos_categories").select("user_id"),
      supabaseAdmin.from("lifeos_habits").select("user_id"),
      supabaseAdmin.from("lifeos_habit_logs").select("user_id"),
      supabaseAdmin.from("lifeos_routine_items").select("user_id"),
      supabaseAdmin.from("lifeos_routine_logs").select("user_id"),
    ]);

    if (categories.error) throw categories.error;
    if (habits.error) throw habits.error;
    if (habitLogs.error) throw habitLogs.error;
    if (routineItems.error) throw routineItems.error;
    if (routineLogs.error) throw routineLogs.error;

    categories.data?.forEach((row) => addScore(scores, row.user_id, "categories"));
    habits.data?.forEach((row) => addScore(scores, row.user_id, "habits"));
    habitLogs.data?.forEach((row) => addScore(scores, row.user_id, "habitLogs"));
    routineItems.data?.forEach((row) => addScore(scores, row.user_id, "routineItems"));
    routineLogs.data?.forEach((row) => addScore(scores, row.user_id, "routineLogs"));

    const adminScore = scores.get(adminUser.id) ?? emptyScore();
    if (totalScore(adminScore) === 0) {
      const sourceUserId = [...scores.entries()]
        .filter(([userId]) => userId !== adminUser.id)
        .sort((a, b) => {
          const diff = totalScore(b[1]) - totalScore(a[1]);
          if (diff !== 0) return diff;
          if (a[0] === LEGACY_SENTINEL_USER_ID) return 1;
          if (b[0] === LEGACY_SENTINEL_USER_ID) return -1;
          return 0;
        })[0]?.[0];

      if (sourceUserId) {
        const updates = await Promise.all([
          supabaseAdmin.from("lifeos_categories").update({ user_id: adminUser.id }).eq("user_id", sourceUserId),
          supabaseAdmin.from("lifeos_habits").update({ user_id: adminUser.id }).eq("user_id", sourceUserId),
          supabaseAdmin.from("lifeos_habit_logs").update({ user_id: adminUser.id }).eq("user_id", sourceUserId),
          supabaseAdmin.from("lifeos_routine_items").update({ user_id: adminUser.id }).eq("user_id", sourceUserId),
          supabaseAdmin.from("lifeos_routine_logs").update({ user_id: adminUser.id }).eq("user_id", sourceUserId),
        ]);
        const failed = updates.find((result) => result.error);
        if (failed?.error) throw failed.error;
      }
    }

    return { ok: true as const, email: ADMIN_EMAIL, password: INTERNAL_ADMIN_PASSWORD };
  });