import { getStorage, setStorage } from "@/storage/storage";

const ONBOARDING_KEY = "@gymos/onboarding-complete";

export async function getOnboardingComplete(): Promise<boolean> {
  return (await getStorage<boolean>(ONBOARDING_KEY)) ?? false;
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
  await setStorage(ONBOARDING_KEY, complete);
}