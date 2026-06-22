export type Habit = { id: string; name: string; emoji?: string };
export type HabitState = {
  items: Habit[];
  logs: Record<string, Record<string, boolean>>; // date -> habitId -> done
};

const id = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_HABITS: HabitState = {
  items: [
    { id: id(), name: "Wake up 4–5 AM", emoji: "🌅" },
    { id: id(), name: "Sleep before 10 PM", emoji: "🌙" },
    { id: id(), name: "Gym", emoji: "🏋️" },
    { id: id(), name: "Meditation", emoji: "🧘" },
    { id: id(), name: "Manifestation", emoji: "✨" },
    { id: id(), name: "Eye Exercise", emoji: "👁️" },
    { id: id(), name: "3 Litres Water", emoji: "💧" },
    { id: id(), name: "Hair Oil", emoji: "🫒" },
    { id: id(), name: "Face Wash", emoji: "🧼" },
    { id: id(), name: "Learning", emoji: "📚" },
    { id: id(), name: "Financial Mgmt", emoji: "💰" },
    { id: id(), name: "Client Calls", emoji: "📞" },
  ],
  logs: {},
};
