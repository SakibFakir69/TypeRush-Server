
export const getLevelFromXp = (xp: number) => {
  let level = 1;
  let required = 100;
  let remaining = xp;
  while (remaining >= required) {
    remaining -= required;
    level += 1;
    required = level * 100;
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: required };
};