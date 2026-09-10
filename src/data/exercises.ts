/**
 * Curated v1 exercise catalogue (Feature Catalogue Module 02).
 * Shared by the Hub exercise library and the workout exercise picker.
 */

export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Arms"
  | "Legs"
  | "Core";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "cable"
  | "machine"
  | "bodyweight"
  | "kettlebell"
  | "ez-bar"
  | "smith-machine";

export type ExerciseType = "compound" | "isolation";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Exercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  type: ExerciseType;
  difficulty: Difficulty;
  primaryMuscles: string[];
  secondaryMuscles?: string[];
  instructions?: string;
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
];

export const EXERCISES: Exercise[] = [
  // ── Chest ──
  {
    id: "bench-press",
    name: "Bench Press",
    muscleGroup: "Chest",
    equipment: "barbell",
    type: "compound",
    difficulty: "intermediate",
    primaryMuscles: ["Pectoralis Major", "Anterior Deltoid", "Triceps Brachii"],
    secondaryMuscles: ["Serratus Anterior", "Coracobrachialis"],
    instructions: "Lie on a flat bench with eyes under the bar. Grip slightly wider than shoulder-width. Lower bar to mid-chest with control. Press up explosively, driving feet into floor.",
  },
  {
    id: "incline-bench-press",
    name: "Incline Bench Press",
    muscleGroup: "Chest",
    equipment: "barbell",
    type: "compound",
    difficulty: "intermediate",
    primaryMuscles: ["Clavicular Pectoralis Major", "Anterior Deltoid", "Triceps Brachii"],
    secondaryMuscles: ["Serratus Anterior"],
    instructions: "Set bench to 30-45° incline. Grip bar slightly wider than shoulders. Lower to upper chest. Press up and slightly back toward face.",
  },
  {
    id: "pec-fly",
    name: "Pec Fly",
    muscleGroup: "Chest",
    equipment: "dumbbell",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Pectoralis Major"],
    secondaryMuscles: ["Anterior Deltoid", "Biceps Brachii (stabilizer)"],
    instructions: "Lie on flat bench with dumbbells above chest, palms facing. Slight elbow bend maintained throughout. Lower in wide arc until chest stretch. Squeeze to return.",
  },

  // ── Back ──
  {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    muscleGroup: "Back",
    equipment: "cable",
    type: "compound",
    difficulty: "beginner",
    primaryMuscles: ["Latissimus Dorsi"],
    secondaryMuscles: ["Teres Major", "Rhomboids", "Posterior Deltoid", "Biceps Brachii"],
    instructions: "Sit with thighs under pad. Wide grip, lean back slightly. Pull bar to upper chest, driving elbows down. Control return. Avoid excessive leaning back.",
  },
  {
    id: "pull-up",
    name: "Pull-up",
    muscleGroup: "Back",
    equipment: "bodyweight",
    type: "compound",
    difficulty: "advanced",
    primaryMuscles: ["Latissimus Dorsi"],
    secondaryMuscles: ["Teres Major", "Rhomboids", "Posterior Deltoid", "Biceps Brachii"],
    instructions: "Hang from bar with full grip, shoulders engaged. Pull chest to bar, driving elbows down. Lower with control. Use band assist if needed.",
  },
  {
    id: "barbell-row",
    name: "Barbell Row",
    muscleGroup: "Back",
    equipment: "barbell",
    type: "compound",
    difficulty: "intermediate",
    primaryMuscles: ["Latissimus Dorsi", "Rhomboids", "Middle Trapezius"],
    secondaryMuscles: ["Posterior Deltoid", "Biceps Brachii", "Erector Spinae"],
    instructions: "Hinge at hips ~45°, bar under chest. Overhand grip. Row to lower ribs/upper abs. Keep torso angle constant. Lower with control.",
  },
  {
    id: "seated-cable-row",
    name: "Seated Cable Row",
    muscleGroup: "Back",
    equipment: "cable",
    type: "compound",
    difficulty: "beginner",
    primaryMuscles: ["Latissimus Dorsi", "Rhomboids", "Middle Trapezius"],
    secondaryMuscles: ["Posterior Deltoid", "Biceps Brachii"],
    instructions: "Sit tall, chest up. Neutral or wide grip. Pull handle to lower ribs, squeezing shoulder blades. Control return without rounding shoulders forward.",
  },
  {
    id: "deadlift",
    name: "Deadlift",
    muscleGroup: "Back",
    equipment: "barbell",
    type: "compound",
    difficulty: "advanced",
    primaryMuscles: ["Erector Spinae", "Gluteus Maximus", "Hamstrings"],
    secondaryMuscles: ["Latissimus Dorsi", "Trapezius", "Forearms", "Quadriceps"],
    instructions: "Feet hip-width, bar over mid-foot. Hinge and grip outside legs. Chest up, lats tight. Drive floor away, extend hips/knees together. Reverse under control.",
  },

  // ── Shoulders ──
  {
    id: "overhead-press",
    name: "Overhead Press",
    muscleGroup: "Shoulders",
    equipment: "barbell",
    type: "compound",
    difficulty: "intermediate",
    primaryMuscles: ["Anterior Deltoid", "Lateral Deltoid", "Triceps Brachii"],
    secondaryMuscles: ["Upper Trapezius", "Serratus Anterior", "Core (stabilizer)"],
    instructions: "Bar at collarbone, grip just outside shoulders. Press straight up, head back then forward through arms. Lock out overhead. Lower to collarbone.",
  },
  {
    id: "lateral-raise",
    name: "Lateral Raise",
    muscleGroup: "Shoulders",
    equipment: "dumbbell",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Lateral Deltoid"],
    secondaryMuscles: ["Anterior Deltoid", "Supraspinatus", "Trapezius (upper)"],
    instructions: "Stand tall, slight elbow bend. Raise arms to shoulder height in scapular plane (~30° forward). Thumbs slightly down at top. Control down.",
  },
  {
    id: "rear-delt-fly",
    name: "Rear Delt Fly",
    muscleGroup: "Shoulders",
    equipment: "dumbbell",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Posterior Deltoid"],
    secondaryMuscles: ["Rhomboids", "Middle Trapezius", "Infraspinatus"],
    instructions: "Hinge at hips ~45°, chest up. Dumbbells hang below. Raise in wide arc, squeezing shoulder blades. Lead with elbows, not hands.",
  },

  // ── Arms ──
  {
    id: "bicep-curl",
    name: "Bicep Curl",
    muscleGroup: "Arms",
    equipment: "dumbbell",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Biceps Brachii", "Brachialis"],
    secondaryMuscles: ["Brachioradialis", "Forearm Flexors"],
    instructions: "Stand or sit, elbows pinned to sides. Supinate (palms up) throughout. Curl to shoulder height. Lower slowly. No swinging.",
  },
  {
    id: "hammer-curl",
    name: "Hammer Curl",
    muscleGroup: "Arms",
    equipment: "dumbbell",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Brachialis", "Brachioradialis"],
    secondaryMuscles: ["Biceps Brachii"],
    instructions: "Neutral grip (palms facing) throughout. Elbows pinned. Curl to shoulder. Emphasizes brachialis for arm thickness.",
  },
  {
    id: "tricep-pushdown",
    name: "Tricep Pushdown",
    muscleGroup: "Arms",
    equipment: "cable",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Triceps Brachii (all heads)"],
    secondaryMuscles: ["Anconeus"],
    instructions: "Elbows pinned to ribs. Press down to full extension. Slight forward lean OK. Control return. Rope or straight bar.",
  },
  {
    id: "skull-crusher",
    name: "Skull Crusher",
    muscleGroup: "Arms",
    equipment: "ez-bar",
    type: "isolation",
    difficulty: "intermediate",
    primaryMuscles: ["Triceps Brachii (long head emphasis)"],
    secondaryMuscles: [],
    instructions: "Lie on bench, EZ-bar above forehead. Lower behind head by bending elbows only. Extend back up. Keep upper arms fixed.",
  },

  // ── Legs ──
  {
    id: "squat",
    name: "Squat",
    muscleGroup: "Legs",
    equipment: "barbell",
    type: "compound",
    difficulty: "advanced",
    primaryMuscles: ["Quadriceps", "Gluteus Maximus", "Adductor Magnus"],
    secondaryMuscles: ["Hamstrings", "Erector Spinae", "Core", "Calves"],
    instructions: "Bar on upper traps/back. Feet shoulder-width, toes out slightly. Sit back and down, knees tracking toes. Drive up through mid-foot.",
  },
  {
    id: "leg-press",
    name: "Leg Press",
    muscleGroup: "Legs",
    equipment: "machine",
    type: "compound",
    difficulty: "beginner",
    primaryMuscles: ["Quadriceps", "Gluteus Maximus"],
    secondaryMuscles: ["Hamstrings", "Adductors", "Calves"],
    instructions: "Back flat against pad. Feet shoulder-width on platform. Lower until knees ~90°. Press through heels/mid-foot. Don't lock knees.",
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    muscleGroup: "Legs",
    equipment: "barbell",
    type: "compound",
    difficulty: "intermediate",
    primaryMuscles: ["Hamstrings", "Gluteus Maximus"],
    secondaryMuscles: ["Erector Spinae", "Adductor Magnus", "Forearms"],
    instructions: "Bar at hips, slight knee bend. Hinge at hips, push glutes back. Lower until hamstring stretch. Drive hips forward to stand. Keep bar close.",
  },
  {
    id: "leg-curl",
    name: "Leg Curl",
    muscleGroup: "Legs",
    equipment: "machine",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Hamstrings"],
    secondaryMuscles: ["Gastrocnemius", "Popliteus"],
    instructions: "Adjust pad above heels. Curl heels to glutes. Control return. Hips stay on pad. Seated or lying variant.",
  },
  {
    id: "leg-extension",
    name: "Leg Extension",
    muscleGroup: "Legs",
    equipment: "machine",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Quadriceps (rectus femoris emphasis)"],
    secondaryMuscles: [],
    instructions: "Knees aligned with pivot. Extend to full lockout. Squeeze quads. Control down. Don't hyperextend knees.",
  },
  {
    id: "standing-calf-raise",
    name: "Standing Calf Raise",
    muscleGroup: "Legs",
    equipment: "machine",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Gastrocnemius"],
    secondaryMuscles: ["Soleus"],
    instructions: "Shoulders under pads, balls of feet on platform. Rise onto toes fully. Pause at top. Lower below platform level for stretch.",
  },

  // ── Core ──
  {
    id: "plank",
    name: "Plank",
    muscleGroup: "Core",
    equipment: "bodyweight",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Rectus Abdominis", "Transverse Abdominis", "Obliques"],
    secondaryMuscles: ["Glutes", "Quadriceps", "Serratus Anterior", "Deltoids"],
    instructions: "Forearms on ground, elbows under shoulders. Body straight line. Brace core, squeeze glutes. Don't sag or pike hips.",
  },
  {
    id: "crunch",
    name: "Crunch",
    muscleGroup: "Core",
    equipment: "bodyweight",
    type: "isolation",
    difficulty: "beginner",
    primaryMuscles: ["Rectus Abdominis"],
    secondaryMuscles: ["Obliques"],
    instructions: "Lie supine, knees bent, feet flat. Hands lightly at ears. Curl shoulders off floor, ribs to hips. Lower with control. Don't pull neck.",
  },
  {
    id: "hanging-leg-raise",
    name: "Hanging Leg Raise",
    muscleGroup: "Core",
    equipment: "bodyweight",
    type: "isolation",
    difficulty: "advanced",
    primaryMuscles: ["Rectus Abdominis (lower emphasis)", "Hip Flexors"],
    secondaryMuscles: ["Obliques", "Latissimus Dorsi", "Forearms"],
    instructions: "Hang from bar, slight shoulder engagement. Raise straight legs to 90° (or higher). Control down. Don't swing. Bent-knee regression available.",
  },
];

export function getExercisesByGroup(
  group: MuscleGroup,
): Exercise[] {
  return EXERCISES.filter((e) => e.muscleGroup === group);
}

export function findExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}