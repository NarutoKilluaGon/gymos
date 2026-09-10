import * as ImagePicker from "expo-image-picker";

import { addProgressPhoto } from "@/storage/repositories/progress-photos";
import { showToast } from "@/utils/toast";

export async function pickAndSavePhotoFromLibrary(): Promise<void> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    showToast("Photo library access needed");
    return;
  }

  const result =
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

  if (result.canceled) {
    return;
  }

  const asset = result.assets?.[0];

  if (!asset) {
    return;
  }

  try {
    await addProgressPhoto(asset.uri);
    showToast("Progress photo added", "success");
  } catch {
    showToast("Couldn't save photo");
  }
}