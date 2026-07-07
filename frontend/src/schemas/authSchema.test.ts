import { loginSchema, signupSchema } from './authSchema';

describe('loginSchema', () => {
  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'password123' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('email');
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('email');
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('password');
  });

  it('accepts valid input', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret123' });
    expect(result.success).toBe(true);
  });
});

describe('signupSchema', () => {
  const validData = {
    email: 'user@example.com',
    password: 'strongpass8',
    passwordConfirm: 'strongpass8',
  };

  it('rejects mismatched passwords', () => {
    const result = signupSchema.safeParse({
      ...validData,
      passwordConfirm: 'different',
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0] ?? i.path[1]);
    expect(paths).toContain('passwordConfirm');
  });

  it('rejects short password (less than 8 characters)', () => {
    const result = signupSchema.safeParse({
      ...validData,
      password: 'short',
      passwordConfirm: 'short',
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('password');
  });

  it('accepts valid input', () => {
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });
});
