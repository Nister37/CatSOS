import reducer, { setCredentials, setAccessToken, signOut, type AuthUser } from './authSlice';

const mockUser: AuthUser = {
  id: 1,
  email: 'coordinator@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  avatarFallback: 'JD',
};

beforeEach(() => localStorage.clear());

describe('authSlice — setCredentials', () => {
  it('stores user and tokens in state', () => {
    const state = reducer(
      undefined,
      setCredentials({ user: mockUser, accessToken: 'access123', refreshToken: 'refresh456' }),
    );

    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe('access123');
    expect(state.refreshToken).toBe('refresh456');
  });

  it('persists tokens to localStorage', () => {
    reducer(
      undefined,
      setCredentials({ user: mockUser, accessToken: 'access123', refreshToken: 'refresh456' }),
    );

    const stored = JSON.parse(localStorage.getItem('catsos_auth') ?? '{}');
    expect(stored.accessToken).toBe('access123');
    expect(stored.refreshToken).toBe('refresh456');
  });
});

describe('authSlice — setAccessToken', () => {
  it('updates tokens without clearing the user', () => {
    const loggedIn = reducer(
      undefined,
      setCredentials({ user: mockUser, accessToken: 'old', refreshToken: 'old-r' }),
    );

    const updated = reducer(
      loggedIn,
      setAccessToken({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    );

    expect(updated.user).toEqual(mockUser);
    expect(updated.accessToken).toBe('new-access');
    expect(updated.refreshToken).toBe('new-refresh');
  });

  it('persists the new tokens to localStorage', () => {
    reducer(
      undefined,
      setAccessToken({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    );

    const stored = JSON.parse(localStorage.getItem('catsos_auth') ?? '{}');
    expect(stored.accessToken).toBe('new-access');
  });
});

describe('authSlice — signOut', () => {
  it('clears user and tokens from state', () => {
    const loggedIn = reducer(
      undefined,
      setCredentials({ user: mockUser, accessToken: 'access123', refreshToken: 'refresh456' }),
    );

    const signedOut = reducer(loggedIn, signOut());

    expect(signedOut.user).toBeNull();
    expect(signedOut.accessToken).toBeNull();
    expect(signedOut.refreshToken).toBeNull();
  });

  it('removes tokens from localStorage', () => {
    reducer(
      undefined,
      setCredentials({ user: mockUser, accessToken: 'access123', refreshToken: 'refresh456' }),
    );
    reducer(undefined, signOut());

    expect(localStorage.getItem('catsos_auth')).toBeNull();
  });
});
