import { reportStep1Schema } from './reportStep1Schema';

describe('reportStep1Schema', () => {
  const base = { catName: 'Luna', breedColor: 'Tuxedo', hasMicrochip: 'no' as const };

  it('accepts valid data with hasMicrochip: no', () => {
    expect(reportStep1Schema.safeParse(base).success).toBe(true);
  });

  it('accepts valid data with hasMicrochip: yes and a chip number', () => {
    const result = reportStep1Schema.safeParse({
      ...base,
      hasMicrochip: 'yes',
      chipNumber: '123456789012345',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.chipNumber).toBe('123456789012345');
  });

  it('accepts hasMicrochip: yes without a chip number (chip number is optional)', () => {
    expect(
      reportStep1Schema.safeParse({ ...base, hasMicrochip: 'yes' }).success,
    ).toBe(true);
  });

  it('rejects catName shorter than 2 characters', () => {
    const result = reportStep1Schema.safeParse({ ...base, catName: 'A' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('catName');
  });

  it('rejects empty breedColor', () => {
    const result = reportStep1Schema.safeParse({ ...base, breedColor: '' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('breedColor');
  });

  it('rejects an invalid hasMicrochip value', () => {
    const result = reportStep1Schema.safeParse({ ...base, hasMicrochip: 'maybe' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('hasMicrochip');
  });
});
