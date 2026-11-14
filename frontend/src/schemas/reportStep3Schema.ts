import { z } from 'zod';

export const reportStep3Schema = z.object({
  ownerName: z.string().min(2, 'Please enter your full name'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  email: z.string().email('Please enter a valid email address'),
  notifyPush: z.boolean(),
  notifySms: z.boolean(),
  notifyEmail: z.boolean(),
  publicSummary: z.string().max(240, 'Public summary cannot exceed 240 characters').optional(),
});

export type ReportStep3Data = z.infer<typeof reportStep3Schema>;
