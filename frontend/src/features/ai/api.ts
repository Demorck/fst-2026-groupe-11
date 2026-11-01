import { apiFetch } from '../../api/client.ts';
import type {
  AttendancePredictionInput,
  AttendancePredictionResult,
} from './types.ts';

export const predictAttendance = (input: AttendancePredictionInput) =>
  apiFetch<AttendancePredictionResult>('/ai/attendance-prediction', {
    method: 'POST',
    body: JSON.stringify(input),
  });
