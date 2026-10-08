export function homeForRole(role) {
  if (role === "sales") return "/leads";
  if (role === "purchase") return "/purchase";
  return "/dashboard";
}
