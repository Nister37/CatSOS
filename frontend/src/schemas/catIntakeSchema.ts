import { z } from 'zod';

export const catIntakeSchema = z.object({
  catName: z.string().trim().min(2, 'Enter at least 2 characters.'),
  reporterEmail: z.email('Enter a valid email address.'),
  urgency: z.enum(['low', 'medium', 'high']),
  description: z.string().trim().min(10, 'Enter at least 10 characters.').max(500, 'Keep it under 500 characters.'),
});

export type CatIntakeForm = z.infer<typeof catIntakeSchema>;
