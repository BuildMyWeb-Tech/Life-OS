const KEY = "lifeos:auth";
const USER = (import.meta.env.VITE_ADMIN_USERNAME as string) || "admin";
const PASS = (import.meta.env.VITE_ADMIN_PASSWORD as string) || "admin@2026";

export function login(username: string, password: string) {
  if (username === USER && password === PASS) {
    if (typeof window !== "undefined") localStorage.setItem(KEY, "1");
    return true;
  }
  return false;
}
export function logout() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}
export function isAuthed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}
