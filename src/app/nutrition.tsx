import { useLocalSearchParams } from "expo-router";
import { Utensils } from "lucide-react-native";
import { StyleSheet, View } from "react-native";

import {
  NourishApp,
  type NourishViewId,
} from "@/components/nutrition/nourish-app";
import { ModuleDisabled } from "@/components/ui/module-disabled";
import { N } from "@/constants/nourish-theme";
import { useModules } from "@/contexts/modules-context";

const VIEWS: readonly NourishViewId[] = ["today", "insights", "kitchen", "me"];

export default function NutritionScreen() {
  const { enabled } = useModules();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const requested = VIEWS.find((id) => id === view);

  if (!enabled.nutrition) {
    return (
      <View style={styles.container}>
        <ModuleDisabled
          moduleId="nutrition"
          title="Nutrition"
          description="Log meals, track macros, and manage your saved foods."
          Icon={Utensils}
        />
      </View>
    );
  }

  return <NourishApp requestedView={requested} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: N.bg },
});
