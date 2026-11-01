import type { EventCategory } from '../events/types.ts';

export interface AttendancePredictionInput {
  category: EventCategory;
  startsAt: string;
  capacity: number;
}

export interface AttendancePredictionResult {
  /** Expected tickets, null when there is no history at all */
  estimate: number | null;
  /** Expected fill rate between 0 and 1 */
  fillRate: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Past events of the same category behind the estimate */
  sampleSize: number;
  warning: {
    type: 'OVERBOOKING_RISK' | 'UNDERBOOKING_RISK';
    message: string;
  } | null;
}
