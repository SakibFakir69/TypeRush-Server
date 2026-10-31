export interface AnalyticsSummary {
  matches: number;
  matchesChange: number;
  practiceTests: number;
  practiceTestsChange: number;
  newUsers: number;
  newUsersChange: number;
  activeNow: number;
}

export interface TimeseriesPoint {
  date: string; // ISO date, e.g. "2026-10-24"
  matches: number;
  practiceTests: number;
  newUsers: number;
}

export interface RawDayCount {
  day: Date;
  count: bigint;
}

export const ALLOWED_RANGES = [7, 14, 30, 90] as const;
export type AllowedRange = (typeof ALLOWED_RANGES)[number];