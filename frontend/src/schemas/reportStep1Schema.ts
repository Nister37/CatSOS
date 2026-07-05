import { z } from 'zod';

export const reportStep1Schema = z.object({
  catName: z.string().min(2, 'Name must be at least 2 characters'),
  breedColor: z.string().min(1, 'Please describe the breed or color'),
  hasMicrochip: z.enum(['yes', 'no']),
  chipNumber: z.string().optional(),
});

export type ReportStep1Data = z.infer<typeof reportStep1Schema>;
