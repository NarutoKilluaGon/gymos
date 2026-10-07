/**
 * Forge's exercise library: coaching cues and bodyweight flags for common
 * lifts. Merged with the core catalogue (data/exercises.ts) at runtime by
 * services/forge/catalog.ts; the core catalogue keeps its own ids and
 * metadata, this only adds entries it lacks plus cues and bodyweight info.
 */
export type ForgeLibraryEntry = {
  name: string;
  muscleGroup: "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Core";
  /** Load is body weight plus an optional extra (negative = assisted). */
  bodyweight: boolean;
  /** Secondary muscles worked. */
  secondary: string;
  /** Short how-to cue. */
  how: string;
};

export const FORGE_LIBRARY: readonly ForgeLibraryEntry[] = [
  { name: "Bench Press", muscleGroup: "Chest", bodyweight: false, secondary: "Triceps, front delts", how: "Shoulder blades pinched back and down, feet planted. Lower the bar to mid-chest with forearms vertical, then press up in a slight arc." },
  { name: "Dumbbell Bench Press", muscleGroup: "Chest", bodyweight: false, secondary: "Triceps, front delts", how: "Same setup as the barbell bench. Lower until elbows are just below the bench line, press up and slightly in without clanking the dumbbells." },
  { name: "Incline Bench Press", muscleGroup: "Chest", bodyweight: false, secondary: "Upper chest, front delts, triceps", how: "Bench at about 30 degrees. Lower to the upper chest and press straight up. Steeper angles shift the work to the shoulders." },
  { name: "Incline DB Press", muscleGroup: "Chest", bodyweight: false, secondary: "Upper chest, front delts, triceps", how: "Bench at about 30 degrees, wrists stacked over elbows. Lower for 2 to 3 seconds and press up without flaring the elbows out." },
  { name: "Push-up", muscleGroup: "Chest", bodyweight: true, secondary: "Triceps, front delts, core", how: "Hands under shoulders, body in a straight line. Lower the chest to just above the floor with elbows about 45 degrees from the body, then push away." },
  { name: "Dip", muscleGroup: "Chest", bodyweight: true, secondary: "Triceps, front delts", how: "Lean slightly forward to bias the chest. Lower until upper arms are about parallel to the floor, then press up. Stop if your shoulders pinch." },
  { name: "Cable Fly", muscleGroup: "Chest", bodyweight: false, secondary: "Front delts", how: "Keep a slight, fixed bend in the elbows. Bring the hands together in a wide hugging arc and squeeze, then return slowly to a stretch." },
  { name: "Dumbbell Fly", muscleGroup: "Chest", bodyweight: false, secondary: "Front delts", how: "Fixed slight elbow bend. Open the arms wide until you feel a chest stretch, then bring the weights back over the chest. Keep it light." },
  { name: "Deadlift", muscleGroup: "Back", bodyweight: false, secondary: "Glutes, hamstrings, lower back, traps", how: "Bar over mid-foot, hips back, flat back, lats tight. Push the floor away and lock out with hips and knees together. Lower under control." },
  { name: "Barbell Row", muscleGroup: "Back", bodyweight: false, secondary: "Biceps, rear delts, lower back", how: "Hinge to about 45 degrees with a flat back. Pull the bar to the lower ribs with elbows close, and lower with control without standing up to cheat." },
  { name: "One-Arm Dumbbell Row", muscleGroup: "Back", bodyweight: false, secondary: "Biceps, rear delts", how: "Hand and knee on a bench, back flat. Pull the dumbbell toward your hip rather than straight up, and let the shoulder blade stretch at the bottom." },
  { name: "Seated Cable Row", muscleGroup: "Back", bodyweight: false, secondary: "Biceps, rear delts", how: "Chest tall with only a slight lean. Pull the handle to the stomach and squeeze the shoulder blades together, then let the arms extend fully." },
  { name: "Lat Pulldown", muscleGroup: "Back", bodyweight: false, secondary: "Biceps, rear delts", how: "Grip slightly wider than shoulders. Pull the bar to the upper chest by driving the elbows down. Lean back slightly and do not swing." },
  { name: "Pull-up", muscleGroup: "Back", bodyweight: true, secondary: "Biceps, rear delts, core", how: "Start from a dead hang with shoulders down. Pull until your chin clears the bar with elbows driving down, then lower fully under control." },
  { name: "Chin-up", muscleGroup: "Back", bodyweight: true, secondary: "Biceps, rear delts", how: "Palms facing you, about shoulder width. Pull your chest toward the bar and lower to a full hang each rep." },
  { name: "Inverted Row", muscleGroup: "Back", bodyweight: true, secondary: "Biceps, rear delts, core", how: "Bar at waist height, body straight from heels to head. Pull the chest to the bar and squeeze the shoulder blades. Walk the feet forward to make it harder." },
  { name: "Back Extension", muscleGroup: "Back", bodyweight: true, secondary: "Glutes, hamstrings", how: "Hips on the pad, body straight. Hinge down from the hips and rise until your body is in a line. Do not over-arch at the top." },
  { name: "Shrug", muscleGroup: "Back", bodyweight: false, secondary: "Traps", how: "Hold the weights at your sides and lift the shoulders straight up toward the ears. Pause at the top and lower slowly. No rolling." },
  { name: "Overhead Press", muscleGroup: "Shoulders", bodyweight: false, secondary: "Triceps, upper chest, core", how: "Ribs down, glutes tight. Press the bar straight up, moving your head through at the top so the bar ends over mid-foot." },
  { name: "Dumbbell Shoulder Press", muscleGroup: "Shoulders", bodyweight: false, secondary: "Triceps", how: "Dumbbells at shoulder height, seated or standing. Press up until the arms are straight without shrugging, and lower to ear level." },
  { name: "Lateral Raise", muscleGroup: "Shoulders", bodyweight: false, secondary: "Traps", how: "Slight elbow bend. Lead with the elbows and raise to shoulder height. Keep the weight light and avoid swinging." },
  { name: "Rear Delt Fly", muscleGroup: "Shoulders", bodyweight: false, secondary: "Upper back", how: "Hinge forward with arms hanging. Open the arms out to the sides with a slight elbow bend, squeezing the shoulder blades. Light weight." },
  { name: "Face Pull", muscleGroup: "Shoulders", bodyweight: false, secondary: "Upper back, rotator cuff", how: "Rope at face height. Pull toward your forehead with elbows high and hands splitting apart. Light weight, slow reps." },
  { name: "Biceps Curl", muscleGroup: "Arms", bodyweight: false, secondary: "Forearms", how: "Elbows pinned to your sides. Curl up without swinging, squeeze at the top, and lower slowly to a full stretch." },
  { name: "Hammer Curl", muscleGroup: "Arms", bodyweight: false, secondary: "Forearms, brachialis", how: "Palms face each other. Curl up with the elbows still. Works the muscle under the biceps and the forearm." },
  { name: "Preacher Curl", muscleGroup: "Arms", bodyweight: false, secondary: "Brachialis", how: "Upper arms flat on the pad. Curl up and lower slowly, stopping just short of locking out to protect the elbow." },
  { name: "Triceps Pushdown", muscleGroup: "Arms", bodyweight: false, secondary: "Forearms", how: "Elbows pinned at your sides. Push down until the arms are straight, squeeze, then let the handle rise slowly until the forearms are just past parallel." },
  { name: "Overhead Triceps Extension", muscleGroup: "Arms", bodyweight: false, secondary: "Long head of triceps, core", how: "Hold one weight overhead with elbows pointing forward. Lower behind the head by bending only at the elbows, then extend back up." },
  { name: "Skull Crusher", muscleGroup: "Arms", bodyweight: false, secondary: "Triceps", how: "Lie on a bench and lower the bar toward your forehead or just behind the head by bending only the elbows, then extend. Keep the upper arms still." },
  { name: "Close-Grip Bench Press", muscleGroup: "Arms", bodyweight: false, secondary: "Chest, front delts", how: "Hands about shoulder width, elbows tucked. Lower to the lower chest and press. Keep the wrists straight." },
  { name: "Squat", muscleGroup: "Legs", bodyweight: false, secondary: "Glutes, core, lower back", how: "Bar on the upper back, feet shoulder width. Sit down and slightly back until thighs are at least parallel with knees tracking over toes, then drive up." },
  { name: "Front Squat", muscleGroup: "Legs", bodyweight: false, secondary: "Glutes, core", how: "Bar on the front of the shoulders with elbows high. Stay upright and squat to depth. Lower the weight if the elbows start to sag." },
  { name: "Goblet Squat", muscleGroup: "Legs", bodyweight: false, secondary: "Glutes, core", how: "Hold one dumbbell at the chest. Sit between your knees with an upright chest, then stand. Good for learning squat depth." },
  { name: "Leg Press", muscleGroup: "Legs", bodyweight: false, secondary: "Glutes", how: "Feet shoulder width, mid-platform. Lower until knees are about 90 degrees without the lower back lifting off the seat, then press without locking out hard." },
  { name: "Romanian Deadlift", muscleGroup: "Legs", bodyweight: false, secondary: "Glutes, lower back", how: "Soft knees, push the hips back with the bar sliding along the thighs. Lower until you feel a hamstring stretch, keep the back flat, then drive the hips forward." },
  { name: "Bulgarian Split Squat", muscleGroup: "Legs", bodyweight: false, secondary: "Glutes", how: "Rear foot on a bench, front foot far enough forward that the knee tracks over the toes. Lower straight down and drive through the front heel." },
  { name: "Walking Lunge", muscleGroup: "Legs", bodyweight: false, secondary: "Glutes", how: "Take a long step, lower the back knee toward the floor, then step through. Keep the torso upright." },
  { name: "Hip Thrust", muscleGroup: "Legs", bodyweight: false, secondary: "Hamstrings, core", how: "Upper back on a bench, bar over the hips. Drive through the heels and squeeze the glutes at the top with ribs down. Do not over-arch." },
  { name: "Leg Curl", muscleGroup: "Legs", bodyweight: false, secondary: "Calves", how: "Hips pressed into the pad. Curl the weight toward your glutes under control, and lower slowly through the full range." },
  { name: "Leg Extension", muscleGroup: "Legs", bodyweight: false, secondary: "Quads only (isolation)", how: "Pad just above the ankles. Extend until the legs are straight, pause, and lower slowly. Avoid heavy swinging reps." },
  { name: "Calf Raise", muscleGroup: "Legs", bodyweight: false, secondary: "Soleus", how: "Rise onto your toes as high as possible, pause at the top, and lower to a full stretch. Slow reps beat bouncing." },
  { name: "Plank", muscleGroup: "Core", bodyweight: true, secondary: "Shoulders, glutes", how: "Forearms under shoulders, body in a straight line from head to heels. Squeeze the glutes, brace the abs, and do not let the hips sag. You can log seconds as reps." },
  { name: "Hanging Leg Raise", muscleGroup: "Core", bodyweight: true, secondary: "Hip flexors, forearms", how: "Hang from a bar and raise the legs with control, curling the pelvis up at the top. Avoid swinging." },
  { name: "Crunch", muscleGroup: "Core", bodyweight: true, secondary: "Upper abs", how: "Lower back stays on the floor. Curl the ribs toward the hips with a short range and no pulling on the neck." },
  { name: "Cable Crunch", muscleGroup: "Core", bodyweight: false, secondary: "Abs", how: "Kneel under a rope with the hips still. Curl the ribs toward the pelvis, then return slowly. Do not just bend at the hips." },
  { name: "Ab Wheel", muscleGroup: "Core", bodyweight: true, secondary: "Shoulders, lats", how: "Start on your knees and brace hard. Roll out only as far as you can keep the lower back flat, then roll back with the abs." },
  { name: "Russian Twist", muscleGroup: "Core", bodyweight: true, secondary: "Obliques", how: "Lean back slightly with feet up or down. Rotate the torso side to side, moving the shoulders and not just the arms." },
  { name: "Farmer Carry", muscleGroup: "Core", bodyweight: false, secondary: "Forearms, traps", how: "Heavy weights at your sides, stand tall, and walk with short controlled steps and shoulders back." },
];
