import { parseLocalDate } from './helpers';

/**
 * Validates that an alchemist service start date is not in the future.
 *
 * Bug 1 fix: the original check used `startDate < today`, which rejected past
 * dates while the error message claimed future dates were invalid.
 *
 * @param dateString - ISO date string (`YYYY-MM-DD`) from the profile form.
 * @param referenceDate - Date used as "today" (defaults to now; injectable in tests).
 * @returns An error message when invalid, otherwise `null`.
 */
export function validateServiceStartDate(
  dateString: string,
  referenceDate: Date = new Date()
): string | null {
  const startDate = parseLocalDate(dateString);
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  if (startDate > today) {
    return 'Service start date cannot be in the future';
  }

  return null;
}

/**
 * Resolves the potion order id from a drag-and-drop event.
 *
 * Prefers `dataTransfer` because React state can be stale when `drop` fires.
 *
 * @param dataTransferOrderId - Value from `dataTransfer.getData('text/plain')`.
 * @param stateOrderId - Fallback from component state set in `dragstart`.
 */
export function resolveDraggedOrderId(
  dataTransferOrderId: string,
  stateOrderId: string | null
): string | null {
  return dataTransferOrderId || stateOrderId || null;
}

/**
 * Returns whether a kanban drop should trigger a status mutation.
 *
 * Skips no-op drops when the card is already in the target column.
 *
 * @param orderId - Order being dragged, if any.
 * @param currentStatus - Order status before the drop.
 * @param newStatus - Target column status.
 */
export function shouldApplyStatusChange(
  orderId: string | null | undefined,
  currentStatus: string | undefined,
  newStatus: string
): orderId is string {
  return Boolean(orderId) && currentStatus !== newStatus;
}
