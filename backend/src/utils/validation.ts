/**
 * Server-side validation helpers for alchemist profile data.
 */

/**
 * Validates that a service start date is not in the future.
 *
 * Mirrors `frontend/src/utils/validation.ts` so profile rules are enforced
 * on both client and server (Bug 1 defense-in-depth).
 *
 * @param dateString - ISO date string (`YYYY-MM-DD`).
 * @param referenceDate - Date treated as "today" (injectable in tests).
 * @returns Error message when invalid, otherwise `null`.
 */
export function validateServiceStartDate(
  dateString: string,
  referenceDate: Date = new Date()
): string | null {
  const [year, month, day] = dateString.split('-').map(Number);
  const startDate = new Date(year, month - 1, day);
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  if (startDate > today) {
    return 'Service start date cannot be in the future';
  }

  return null;
}
