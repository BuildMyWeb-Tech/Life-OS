export type RoutineItem = {
  id: string;
  title: string;
  time?: string;
  notes?: string;
};

export type RoutineState = {
  items: RoutineItem[];
  completion: Record<string, Record<string, boolean>>; // date -> id -> done
};

const id = () => Math.random().toString(36).slice(2, 10);

export const DEFAULT_ROUTINE: RoutineState = {
  items: [
    { id: id(), title: "Wake Up", time: "04:30" },
    { id: id(), title: "Brush" },
    { id: id(), title: "Face Wash (Medimix)" },
    { id: id(), title: "Drink 2 Glass Water" },
    { id: id(), title: "Manifestation" },
    { id: id(), title: "Meditation" },
    { id: id(), title: "Eye Exercises" },
    { id: id(), title: "Afresh" },
    { id: id(), title: "Rest Room" },
    { id: id(), title: "Get Ready For Gym" },
    { id: id(), title: "Gym", time: "05:30" },
    { id: id(), title: "Snack / Egg" },
    { id: id(), title: "Make Bed" },
    { id: id(), title: "Ice Face Wash" },
    { id: id(), title: "Hair Wash" },
    { id: id(), title: "Garnier Face Wash" },
    { id: id(), title: "Get Ready For Office" },
    { id: id(), title: "Breakfast" },
    { id: id(), title: "Office", time: "09:30" },
  ],
  completion: {},
};
