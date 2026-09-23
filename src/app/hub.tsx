import { BarChart3, Bell, BookOpen, Dumbbell, FileDown, FolderInput, History, Info, Pill, Scale, SlidersHorizontal, Trophy, Utensils } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AboutSheet } from "@/components/hub/about-sheet";
import { ExportSheet } from "@/components/hub/export-sheet";
import { ImportSheet } from "@/components/hub/import-sheet";
import { ExerciseLibrarySheet } from "@/components/hub/exercise-library-sheet";
import { HubSectionRow } from "@/components/hub/hub-section-row";
import { ModulesSheet } from "@/components/hub/modules-sheet";
import { PersonalRecordsSheet } from "@/components/hub/prs-sheet";
import { WorkoutHistorySheet } from "@/components/hub/workout-history-sheet";
import { RemindersSheet } from "@/components/hub/reminders-sheet";
import { SavedFoodsSheet } from "@/components/hub/saved-foods-sheet";
import { SupplementsSheet } from "@/components/hub/supplements-sheet";
import { InsightsSheet } from "@/components/insights/insights-sheet";
import { JournalTimeline } from "@/components/journal/journal-timeline";
import { GymCard } from "@/components/ui/gym-card";
import { GymColors, Radius, Spacing, Typography } from "@/constants/theme";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { applyReminders } from "@/services/notifications";
import type { ReminderPrefs } from "@/storage/repositories/reminders";

export default function HubScreen() {
  const { unit: weightUnit, toggle: toggleWeightUnit } = useWeightUnit();
  const [modulesOpen, setModulesOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [savedFoodsOpen, setSavedFoodsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [supplementsOpen, setSupplementsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [prsOpen, setPrsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleRemindersSaved(prefs: ReminderPrefs) {
    try {
      await applyReminders(prefs);
    } catch {
      // Scheduling failure shouldn't block closing the sheet.
      console.error("Failed to apply reminders");
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>HUB</Text>
        <Text style={styles.title}>Hub</Text>

        <GymCard style={styles.card}>
          <HubSectionRow
            icon={SlidersHorizontal}
            title="Modules"
            subtitle="Turn features on or off"
            onPress={() => setModulesOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={Scale}
            title="Weight unit"
            subtitle="Tap to switch kg / lb"
            onPress={toggleWeightUnit}
            trailing={
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>{weightUnit}</Text>
              </View>
            }
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={Bell}
            title="Reminders"
            subtitle="Workout, meals, water, streak nudges"
            onPress={() => setRemindersOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={BookOpen}
            title="Journal"
            subtitle="Your timeline of activity"
            onPress={() => setJournalOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={BarChart3}
            title="Insights"
            subtitle="Understand your consistency"
            onPress={() => setInsightsOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={Utensils}
            title="Saved Foods"
            subtitle="Foods you log often"
            onPress={() => setSavedFoodsOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={Dumbbell}
            title="Exercise Library"
            subtitle="Browse by muscle group"
            onPress={() => setLibraryOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={Pill}
            title="Supplements"
            subtitle="What you take daily"
            onPress={() => setSupplementsOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={Trophy}
            title="Personal records"
            subtitle="Your best lift for each exercise"
            onPress={() => setPrsOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={History}
            title="Workout history"
            subtitle="Review your past sessions"
            onPress={() => setHistoryOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={FileDown}
            title="Export data"
            subtitle="Save a copy of your history"
            onPress={() => setExportOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={FolderInput}
            title="Import data"
            subtitle="Restore a backup"
            onPress={() => setImportOpen(true)}
          />

          <View style={styles.divider} />

          <HubSectionRow
            icon={Info}
            title="About"
            subtitle="Version and philosophy"
            onPress={() => setAboutOpen(true)}
          />
        </GymCard>
      </ScrollView>

      <Modal
        visible={modulesOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModulesOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setModulesOpen(false)}
          />
          <ModulesSheet onClose={() => setModulesOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={remindersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRemindersOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setRemindersOpen(false)}
          />
          <RemindersSheet
            onClose={() => setRemindersOpen(false)}
            onSaved={handleRemindersSaved}
          />
        </View>
      </Modal>

      <Modal
        visible={savedFoodsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSavedFoodsOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setSavedFoodsOpen(false)}
          />
          <SavedFoodsSheet onClose={() => setSavedFoodsOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={libraryOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLibraryOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setLibraryOpen(false)}
          />
          <ExerciseLibrarySheet onClose={() => setLibraryOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={supplementsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSupplementsOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setSupplementsOpen(false)}
          />
          <SupplementsSheet onClose={() => setSupplementsOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={prsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPrsOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setPrsOpen(false)}
          />
          <PersonalRecordsSheet onClose={() => setPrsOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={historyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setHistoryOpen(false)}
          />
          <WorkoutHistorySheet onClose={() => setHistoryOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={exportOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setExportOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setExportOpen(false)}
          />
          <ExportSheet onClose={() => setExportOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={importOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setImportOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setImportOpen(false)}
          />
          <ImportSheet onClose={() => setImportOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={aboutOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAboutOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setAboutOpen(false)}
          />
          <AboutSheet onClose={() => setAboutOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={journalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setJournalOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setJournalOpen(false)}
          />
          <JournalTimeline onClose={() => setJournalOpen(false)} />
        </View>
      </Modal>

      <Modal
        visible={insightsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInsightsOpen(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setInsightsOpen(false)}
          />
          <InsightsSheet onClose={() => setInsightsOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GymColors.background.primary,
  },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
  },

  eyebrow: {
    color: GymColors.text.tertiary,
    fontSize: Typography.caption,
  },

  title: {
    color: GymColors.text.primary,
    fontSize: Typography.h1,
    fontWeight: "700",
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },

  card: {
    gap: 0,
  },

  divider: {
    height: 1,
    backgroundColor: GymColors.background.surface,
    marginVertical: Spacing.one,
  },

  unitBadge: {
    backgroundColor: GymColors.background.surface,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  unitBadgeText: {
    color: GymColors.text.primary,
    fontSize: Typography.body,
    fontWeight: "700",
  },

  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
});