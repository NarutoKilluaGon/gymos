// Offline store for tests: AsyncStorage's official jest mock.
jest.mock("@react-native-async-storage/async-storage", () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@/global.css", () => ({}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("react-native-gesture-handler/jestSetup");

jest.mock("react-native-worklets", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-worklets/src/mock");
});

jest.mock("react-native-reanimated", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const reanimated = require("react-native-reanimated/mock");
  return {
    ...reanimated,
    useReducedMotion: () => false,
  };
});

type Insets = { top: number; right: number; bottom: number; left: number };
const mockInsets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

jest.mock("react-native-safe-area-context", () => {
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaConsumer: ({ children }: { children: (insets: Insets) => React.ReactNode }) => children(mockInsets),
    useSafeAreaInsets: () => mockInsets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// lucide-react-native ships ESM that Jest's transform ignores; decoration only.
jest.mock("lucide-react-native", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        return function MockLucideIcon(props: Record<string, unknown>) {
          return React.createElement("Icon-" + String(prop), props);
        };
      },
    },
  );
});