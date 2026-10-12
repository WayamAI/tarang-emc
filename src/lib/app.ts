/**
 * Product identity. The shell (logo, top bar, login, metadata) reads this, so
 * renaming the product is a one-file change.
 */
export const APP = {
  /** One-word Sanskrit product name, rendered as the wordmark. */
  name: "Tarang",
  devanagari: "तरंग",
  /** What the Sanskrit word means, shown once on the sign-in surface. */
  meaning: "wave",
  descriptor: "EMC foresight for appliance design",
  /** Zero-based index of the wordmark letter that takes the brand orange. */
  accentIndex: 1,
  loginHeadline: "See the interference before the chamber does.",
  loginSubline: "Every aggressor, victim and coupling path in the cabinet, scored against the markets you ship to before the first prototype is built.",
  loginNote: "The design workspace is engineer-only.",
  /** Scope pill in the top bar, e.g. the tenant or dataset in view. */
  scope: "Northfield Appliances",
  operator: { name: "Demo Operator", initials: "DO" },
  home: "/dashboard",
  settingsHref: "/settings",
} as const;
