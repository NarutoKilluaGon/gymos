// Ambient declarations for CSS imports. Metro/Expo handles these at build
// time, but TypeScript needs to be told they exist (expo-env.d.ts is
// generated and gitignored, so a clean CI checkout does not have it).

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css";
