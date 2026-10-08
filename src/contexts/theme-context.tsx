import React, { createContext, useContext } from "react";
import { HOME, Theme } from "@/constants/design";

type ThemeContextType = {
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: HOME,
});

export function ThemeProvider({
  theme = HOME,
  children,
}: {
  theme?: Theme;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  return context?.theme ?? HOME;
}
