import type { ID, Timestamp } from "@/types/gymos";

export type TimelineItem =
  | {
      kind: "journal";
      id: ID;
      timestamp: Timestamp;
      text: string;
      mood?: "great" | "good" | "okay" | "tired" | "rough";
    }
  | {
      kind: "workout";
      id: ID;
      timestamp: Timestamp;
      name: string;
      durationMs?: number;
      exerciseCount: number;
      notes?: string;
    }
  | {
      kind: "meal";
      id: ID;
      timestamp: Timestamp;
      name: string;
      calories?: number;
      protein?: number;
    }
  | {
      kind: "measurement";
      id: ID;
      timestamp: Timestamp;
      type: string;
      value: number;
      unit: string;
    }
  | {
      kind: "weight";
      id: ID;
      timestamp: Timestamp;
      weight: number;
      unit: string;
    }
  | {
      kind: "water";
      id: ID;
      timestamp: Timestamp;
      amountMl: number;
    }
  | {
      kind: "sleep";
      id: ID;
      timestamp: Timestamp;
    }
  | {
      kind: "northstar";
      id: ID;
      timestamp: Timestamp;
      title: string;
    }
  | {
      kind: "routine";
      id: ID;
      timestamp: Timestamp;
      name: string;
    }
  | {
      kind: "cardio";
      id: ID;
      timestamp: Timestamp;
      activity: string;
      durationMin: number;
      distanceKm?: number;
      calories?: number;
    };