import { catIntakeSchema } from './catIntakeSchema';

describe('catIntakeSchema', () => {
  it('accepts a complete intake report and trims the cat name', () => {
    const parsed = catIntakeSchema.parse({
      catName: '  Miso  ',
      reporterEmail: 'rescue@example.com',
      urgency: 'high',
      description: 'Small cat found near a busy road.',
    });

    expect(parsed).toEqual({
      catName: 'Miso',
      reporterEmail: 'rescue@example.com',
      urgency: 'high',
      description: 'Small cat found near a busy road.',
    });
  });

  it('rejects incomplete intake reports', () => {
    const result = catIntakeSchema.safeParse({
      catName: 'M',
      reporterEmail: 'not-an-email',
      urgency: 'medium',
      description: 'Too short',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'catName',
      'reporterEmail',
      'description',
    ]);
  });
});
