import { getStorage, setStorage } from "@/storage/storage";

const ONBOARDING_KEY = "@gymos/onboarding-complete";

export async function getOnboardingComplete(): Promise<boolean> {
  return (await getStorage<boolean>(ONBOARDING_KEY)) ?? false;
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
  await setStorage(ONBOARDING_KEY, complete);
}

const CHECKLIST_DISMISSED_KEY = "@gymos/checklist-dismissed";

export async function getChecklistDismissed(): Promise<boolean> {
  return (await getStorage<boolean>(CHECKLIST_DISMISSED_KEY)) ?? false;
}

export async function setChecklistDismissed(dismissed: boolean): Promise<void> {
  await setStorage(CHECKLIST_DISMISSED_KEY, dismissed);
}