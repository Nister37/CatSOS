import { reportStep3Schema } from './reportStep3Schema';

describe('reportStep3Schema', () => {
  const base = {
    ownerName: 'Jane Doe',
    phone: '+44 7700 900123',
    email: 'jane@example.com',
    notifyPush: true,
    notifySms: false,
    notifyEmail: false,
  };

  it('accepts valid contact data', () => {
    expect(reportStep3Schema.safeParse(base).success).toBe(true);
  });

  it('accepts all notification preferences as false', () => {
    expect(
      reportStep3Schema.safeParse({ ...base, notifyPush: false, notifySms: false }).success,
    ).toBe(true);
  });

  it('rejects ownerName shorter than 2 characters', () => {
    const result = reportStep3Schema.safeParse({ ...base, ownerName: 'J' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('ownerName');
  });

  it('rejects an invalid email address', () => {
    const result = reportStep3Schema.safeParse({ ...base, email: 'not-an-email' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('email');
  });

  it('rejects a phone number shorter than 6 characters', () => {
    const result = reportStep3Schema.safeParse({ ...base, phone: '123' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('phone');
  });

  it('rejects missing required fields', () => {
    const result = reportStep3Schema.safeParse({});
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('ownerName');
    expect(paths).toContain('email');
    expect(paths).toContain('phone');
  });
});
