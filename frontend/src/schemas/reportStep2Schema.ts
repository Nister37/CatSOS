import { z } from 'zod';

export const reportStep2Schema = z.object({
  address: z.string().min(5, 'Please enter a street address'),
  landmark: z.string().optional(),
  disappearedAt: z.string().optional(),
});

export type ReportStep2Data = z.infer<typeof reportStep2Schema> & {
  lat?: number;
  lng?: number;
};
