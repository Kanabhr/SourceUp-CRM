import { ServicePrefix } from "./Models/ServicePrefix.schema.js";

const DEFAULT_PREFIXES = [
  { code: "SRC", name: "Sourcing" },
  { code: "PKG", name: "Packaging" },
  { code: "WEB", name: "Website" },
  { code: "SMM", name: "Social Media" },
  { code: "LEG", name: "Legal" },
  { code: "INV", name: "Inventory" },
  { code: "CON", name: "Consulting" },
];

export const seedServicePrefixes = async () => {
  const count = await ServicePrefix.countDocuments();
  if (count > 0) return;
  await ServicePrefix.insertMany(DEFAULT_PREFIXES);
  console.log("Seeded 7 service prefixes: SRC, PKG, WEB, SMM, LEG, INV, CON");
};
