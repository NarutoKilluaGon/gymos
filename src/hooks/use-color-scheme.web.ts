import { useColorScheme as useRNColorScheme } from 'react-native';

// RN's useColorScheme is useSyncExternalStore-based: on web it resolves from
// matchMedia on the client and re-renders itself after static render, so no
// manual hydration flag is needed. The null guard covers server-side render.
export function useColorScheme() {
  return useRNColorScheme() ?? 'light';
}