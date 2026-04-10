// Feature flags read at module load time. Toggle via .env.local then restart
// the dev server. NEXT_PUBLIC_ prefix is required so client components can read
// the same constant without a server round-trip.
//
// Defaults to false so that an unconfigured environment shows the "without"
// version of the app — useful for back-to-back demos.
export const FEATURES = {
  accessories: process.env.NEXT_PUBLIC_FEATURE_ACCESSORIES === "true",
} as const;
