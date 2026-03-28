/**
 * Generate URL-friendly doctor slug.
 * Pattern: dr-{name}-{specialization}-{city}
 */
export function generateDoctorSlug(
  name: string,
  specialization: string,
  city?: string
): string {
  const parts = [name, specialization, city].filter(Boolean) as string[];
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
