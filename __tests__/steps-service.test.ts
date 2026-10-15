import { Pedometer } from "expo-sensors";
import {
  getStepPermissionStatus,
  isStepTrackingActive,
  requestStepPermission,
  startStepTracking,
  stopStepTracking,
} from "@/services/steps";

jest.mock("expo-sensors", () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    watchStepCount: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock("@/storage/repositories/steps", () => ({
  addSteps: jest.fn(() => Promise.resolve()),
}));

describe("steps service (silent check, permission requests, tracking lifecycle)", () => {
  beforeEach(() => {
    stopStepTracking();
    jest.clearAllMocks();
  });

  describe("startStepTracking (silent launch check)", () => {
    it("does not prompt on launch: checks silently with getPermissionsAsync and starts tracking if granted", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
        status: "granted",
      });

      const started = await startStepTracking();
      expect(started).toBe(true);
      expect(isStepTrackingActive()).toBe(true);

      // Verify requestPermissionsAsync was NEVER called (silent check!)
      expect(Pedometer.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(Pedometer.getPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(Pedometer.watchStepCount).toHaveBeenCalledTimes(1);
    });

    it("does not prompt and does not start tracking when permission is not granted", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
        status: "undetermined",
      });

      const started = await startStepTracking();
      expect(started).toBe(false);
      expect(isStepTrackingActive()).toBe(false);
      expect(Pedometer.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(Pedometer.watchStepCount).not.toHaveBeenCalled();
    });

    it("returns false early when pedometer is unavailable on the device", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      const started = await startStepTracking();
      expect(started).toBe(false);
      expect(isStepTrackingActive()).toBe(false);
      expect(Pedometer.getPermissionsAsync).not.toHaveBeenCalled();
      expect(Pedometer.watchStepCount).not.toHaveBeenCalled();
    });
  });

  describe("getStepPermissionStatus", () => {
    it("returns 'unavailable' when pedometer hardware is not available", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      const status = await getStepPermissionStatus();
      expect(status).toBe("unavailable");
    });

    it("returns 'granted' when permission is granted", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });

      const status = await getStepPermissionStatus();
      expect(status).toBe("granted");
    });

    it("returns 'not_granted' when permission is not granted but can ask again", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      const status = await getStepPermissionStatus();
      expect(status).toBe("not_granted");
    });

    it("returns 'blocked' when permission is denied and cannot ask again (Android Settings needed)", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      const status = await getStepPermissionStatus();
      expect(status).toBe("blocked");
    });
  });

  describe("requestStepPermission", () => {
    it("calls requestPermissionsAsync and starts tracking immediately on grant", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });
      (Pedometer.getPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: true,
        canAskAgain: true,
      });

      const status = await requestStepPermission();
      expect(status).toBe("granted");
      expect(Pedometer.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect(isStepTrackingActive()).toBe(true);
    });

    it("returns 'blocked' when user denies and canAskAgain is false", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: false,
      });

      const status = await requestStepPermission();
      expect(status).toBe("blocked");
      expect(isStepTrackingActive()).toBe(false);
    });

    it("returns 'not_granted' when user denies but can ask again", async () => {
      (Pedometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Pedometer.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        granted: false,
        canAskAgain: true,
      });

      const status = await requestStepPermission();
      expect(status).toBe("not_granted");
      expect(isStepTrackingActive()).toBe(false);
    });
  });
});
