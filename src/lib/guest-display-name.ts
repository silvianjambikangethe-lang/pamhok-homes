// "Grace Otieno" -> "Grace O." — enough to identify the guest to security
// without exposing their full legal name. No server-only imports, so this
// is safe to use from both server and client components.
export function firstNameLastInitial(fullName: string | null | undefined): string {
  if (!fullName) return "Guest";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
