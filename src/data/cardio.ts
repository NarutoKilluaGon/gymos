import type { CardioActivity } from "@/types/gymos";

export type CardioActivityDef = {
  id: CardioActivity;
  label: string;
  aliases: readonly string[];
  met: number;
  hasDistance: boolean;
  distanceFactor?: number;
  kind: "steady" | "interval";
  emoji: string;
};

export const CARDIO_ACTIVITIES: readonly CardioActivityDef[] = [
  {
    id: "running",
    label: "Run",
    aliases: ["running", "run", "ran", "sprint", "sprints", "sprinting", "jogging", "jog", "jogged"],
    met: 9.8,
    hasDistance: true,
    distanceFactor: 1.0,
    kind: "steady",
    emoji: "🏃",
  },
  {
    id: "jogging",
    label: "Jog",
    aliases: ["jog", "jogging", "jogged"],
    met: 7.0,
    hasDistance: true,
    distanceFactor: 0.9,
    kind: "steady",
    emoji: "🏃",
  },
  {
    id: "walking",
    label: "Walk",
    aliases: ["walking", "walk", "walked", "stroll", "power walk", "power walking"],
    met: 3.5,
    hasDistance: true,
    distanceFactor: 0.55,
    kind: "steady",
    emoji: "🚶",
  },
  {
    id: "treadmill",
    label: "Treadmill",
    aliases: ["treadmill", "treadmill walk", "treadmill run"],
    met: 4.0,
    hasDistance: true,
    distanceFactor: 0.55,
    kind: "steady",
    emoji: "🏃",
  },
  {
    id: "cycling",
    label: "Cycle",
    aliases: ["cycling", "cycle", "cycled", "biking", "bike", "biked", "road cycle"],
    met: 7.5,
    hasDistance: true,
    distanceFactor: 0.3,
    kind: "steady",
    emoji: "🚴",
  },
  {
    id: "spinning",
    label: "Spinning",
    aliases: ["spinning", "spin bike", "stationary bike", "exercise bike", "indoor cycling", "spin"],
    met: 7.0,
    hasDistance: false,
    kind: "steady",
    emoji: "🚴",
  },
  {
    id: "elliptical",
    label: "Elliptical",
    aliases: [
      "elliptical",
      "elliptical cross",
      "cross trainer",
      "cross-trainer",
      "crosstrainer",
      "cross",
    ],
    met: 5.0,
    hasDistance: false,
    kind: "steady",
    emoji: "🏃‍♀️",
  },
  {
    id: "stairmaster",
    label: "Stairmaster",
    aliases: [
      "stairmaster",
      "stair master",
      "stair climber",
      "stairclimber",
      "stairs",
      "stair climb",
      "stepmill",
    ],
    met: 9.0,
    hasDistance: false,
    kind: "steady",
    emoji: "🪜",
  },
  {
    id: "rowing",
    label: "Rowing",
    aliases: ["rowing machine", "rowing", "rower", "erg", "ergometer", "row"],
    met: 7.0,
    hasDistance: true,
    distanceFactor: 0.6,
    kind: "steady",
    emoji: "🚣",
  },
  {
    id: "swimming",
    label: "Swim",
    aliases: ["swimming", "swim", "swam", "laps", "freestyle", "breaststroke"],
    met: 6.0,
    hasDistance: true,
    distanceFactor: 0.8,
    kind: "steady",
    emoji: "🏊",
  },
  {
    id: "hiking",
    label: "Hike",
    aliases: ["hiking", "hike", "hiked", "trail walk", "trekking"],
    met: 6.0,
    hasDistance: true,
    distanceFactor: 0.65,
    kind: "steady",
    emoji: "🥾",
  },
  {
    id: "hiit",
    label: "HIIT",
    aliases: ["hiit", "interval training", "tabata", "high intensity", "intervals"],
    met: 9.0,
    hasDistance: false,
    kind: "interval",
    emoji: "⚡",
  },
  {
    id: "jump_rope",
    label: "Jump rope",
    aliases: ["skipping", "jump rope", "jumping rope", "rope skipping", "rope"],
    met: 11.0,
    hasDistance: false,
    kind: "interval",
    emoji: "🪢",
  },
  {
    id: "aerobics",
    label: "Aerobics",
    aliases: ["aerobics", "zumba", "dance", "dancing", "dance workout"],
    met: 6.5,
    hasDistance: false,
    kind: "steady",
    emoji: "💃",
  },
  {
    id: "yoga",
    label: "Yoga",
    aliases: ["yoga", "vinyasa", "ashtanga", "hatha", "power yoga"],
    met: 3.0,
    hasDistance: false,
    kind: "steady",
    emoji: "🧘",
  },
  {
    id: "pilates",
    label: "Pilates",
    aliases: ["pilates", "mat pilates", "reformer"],
    met: 3.5,
    hasDistance: false,
    kind: "steady",
    emoji: "🧘",
  },
  {
    id: "boxing",
    label: "Boxing",
    aliases: ["boxing", "kickboxing", "sparring", "shadow boxing", "heavy bag", "punching bag", "muay thai"],
    met: 9.0,
    hasDistance: false,
    kind: "interval",
    emoji: "🥊",
  },
  {
    id: "football",
    label: "Football",
    aliases: ["football", "soccer"],
    met: 8.0,
    hasDistance: false,
    kind: "interval",
    emoji: "⚽",
  },
  {
    id: "cricket",
    label: "Cricket",
    aliases: ["cricket"],
    met: 5.0,
    hasDistance: false,
    kind: "interval",
    emoji: "🏏",
  },
  {
    id: "badminton",
    label: "Badminton",
    aliases: ["badminton"],
    met: 5.5,
    hasDistance: false,
    kind: "interval",
    emoji: "🏸",
  },
  {
    id: "tennis",
    label: "Tennis",
    aliases: ["tennis"],
    met: 7.3,
    hasDistance: false,
    kind: "interval",
    emoji: "🎾",
  },
  {
    id: "table_tennis",
    label: "Table tennis",
    aliases: ["table tennis", "ping pong", "ping-pong"],
    met: 4.0,
    hasDistance: false,
    kind: "steady",
    emoji: "🏓",
  },
  {
    id: "basketball",
    label: "Basketball",
    aliases: ["basketball", "hoops"],
    met: 8.0,
    hasDistance: false,
    kind: "interval",
    emoji: "🏀",
  },
  {
    id: "skating",
    label: "Skating",
    aliases: ["skating", "rollerblading", "ice skating", "inline skating", "roller skating"],
    met: 7.0,
    hasDistance: true,
    distanceFactor: 0.4,
    kind: "steady",
    emoji: "⛸️",
  },
  {
    id: "climbing",
    label: "Climbing",
    aliases: ["climbing", "rock climbing", "bouldering"],
    met: 8.0,
    hasDistance: false,
    kind: "interval",
    emoji: "🧗",
  },
  {
    id: "other",
    label: "Other cardio",
    aliases: ["other cardio", "cardio", "workout", "exercise", "conditioning"],
    met: 4.5,
    hasDistance: false,
    kind: "steady",
    emoji: "⏱️",
  },
  {
    id: "custom",
    label: "Custom",
    aliases: ["custom"],
    met: 4.5,
    hasDistance: false,
    kind: "steady",
    emoji: "✏️",
  },
];

export function findCardioActivity(
  id: CardioActivity,
): CardioActivityDef | undefined {
  return CARDIO_ACTIVITIES.find((a) => a.id === id);
}

/** Find activity by matching text against aliases (longest match preferred). */
export function matchCardioActivity(
  text: string,
): CardioActivityDef | undefined {
  const lower = text.toLowerCase();
  let bestMatch: CardioActivityDef | undefined;
  let maxLen = 0;

  for (const def of CARDIO_ACTIVITIES) {
    if (def.id === "other" || def.id === "custom") continue;
    for (const alias of def.aliases) {
      const regex = new RegExp(`\\b${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
      if (regex.test(lower) && alias.length > maxLen) {
        bestMatch = def;
        maxLen = alias.length;
      }
    }
  }

  return bestMatch;
}