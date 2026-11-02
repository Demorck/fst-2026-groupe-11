import { apiFetch } from '../../api/client.ts';
import type {
  AttendancePredictionInput,
  AttendancePredictionResult,
  CommunicationDrafts,
} from './types.ts';

export const predictAttendance = (input: AttendancePredictionInput) =>
  apiFetch<AttendancePredictionResult>('/ai/attendance-prediction', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const generateCommunication = (eventId: string) =>
  apiFetch<CommunicationDrafts>('/ai/communication', {
    method: 'POST',
    body: JSON.stringify({ eventId }),
  });
