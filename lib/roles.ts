/** Roles that may correct a submitted entry's location (members may not). */
export const LOCATION_EDIT_ROLES = ["admin", "senior", "manager", "tl"];

export function canChangeLocation(role: string | undefined | null): boolean {
  return !!role && LOCATION_EDIT_ROLES.includes(role);
}
