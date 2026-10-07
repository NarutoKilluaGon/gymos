import { Dumbbell } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import { ModuleDisabled } from "@/components/ui/module-disabled";
import { ForgeApp } from "@/components/workouts/forge-app";
import { F } from "@/constants/forge-theme";
import { useModules } from "@/contexts/modules-context";

export default function WorkoutsScreen() {
  const { enabled } = useModules();

  if (!enabled.workouts) {
    return (
      <View style={styles.container}>
        <ModuleDisabled
          moduleId="workouts"
          title="Workouts"
          description="Track your training sessions, routines, and exercises."
          Icon={Dumbbell}
        />
      </View>
    );
  }

  return <ForgeApp />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: F.bg },
});
