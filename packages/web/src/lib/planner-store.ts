/**
 * The route planner's stops (venue ids, in order), kept in this browser only.
 * Storage can be unavailable (private windows, blocked site data), so every
 * access is guarded and the planner still works for the session without it.
 */
const KEY = "greenroom.planner.v1";
let memory: string[] = [];

export function loadPlan(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const ids = JSON.parse(raw) as unknown;
      if (Array.isArray(ids)) memory = ids.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* keep the in-memory copy */
  }
  return [...memory];
}

export function savePlan(ids: string[]): void {
  memory = [...ids];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* in-memory only */
  }
}

/** Add a venue to the end of the plan (no duplicates); returns the new plan. */
export function addToPlan(id: string): string[] {
  const ids = loadPlan();
  if (!ids.includes(id)) ids.push(id);
  savePlan(ids);
  return ids;
}

export function removeFromPlan(id: string): string[] {
  const ids = loadPlan().filter((x) => x !== id);
  savePlan(ids);
  return ids;
}
