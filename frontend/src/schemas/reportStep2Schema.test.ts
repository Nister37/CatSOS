import { reportStep2Schema } from './reportStep2Schema';

describe('reportStep2Schema', () => {
  it('accepts a valid address', () => {
    expect(reportStep2Schema.safeParse({ address: '10 Baker Street' }).success).toBe(true);
  });

  it('accepts an address with an optional landmark', () => {
    const result = reportStep2Schema.safeParse({
      address: '10 Baker Street, London',
      landmark: 'Near Regent\'s Park',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.landmark).toBe("Near Regent's Park");
  });

  it('accepts without landmark — landmark is optional', () => {
    const result = reportStep2Schema.safeParse({ address: 'Maple Avenue, Oslo' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.landmark).toBeUndefined();
  });

  it('rejects an address shorter than 5 characters', () => {
    const result = reportStep2Schema.safeParse({ address: 'Elm' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('address');
  });

  it('rejects a missing address', () => {
    const result = reportStep2Schema.safeParse({});
    expect(result.success).toBe(false);
  });
});
