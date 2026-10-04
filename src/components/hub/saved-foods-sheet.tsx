import { useEffect, useState } from "react";

import { SavedSheet } from "@/components/nutrition/more-sheets";
import {
  deleteSavedFood,
  getSavedFoods,
  type SavedFood,
} from "@/storage/repositories/saved-foods";
import { showToast } from "@/utils/toast";

/** Hub entry point to manage saved meals, remembered foods and recipes.
 *  (Logging from them happens in the Nutrition tab.) */
export function HubSavedFoodsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [foods, setFoods] = useState<SavedFood[]>([]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    getSavedFoods()
      .then((loaded) => {
        if (!cancelled) setFoods(loaded);
      })
      .catch(() => showToast("Couldn't load saved foods"));

    return () => {
      cancelled = true;
    };
  }, [visible]);

  async function remove(food: SavedFood) {
    try {
      await deleteSavedFood(food.id);
      setFoods(await getSavedFoods());
    } catch {
      showToast("Couldn't delete");
    }
  }

  return (
    <SavedSheet
      visible={visible}
      onClose={onClose}
      foods={foods}
      onDelete={(food) => void remove(food)}
    />
  );
}
