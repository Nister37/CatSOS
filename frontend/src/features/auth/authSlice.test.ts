import reducer, { signInDemoUser, signOut } from './authSlice';

describe('authSlice', () => {
  it('signs the demo coordinator in and out', () => {
    const signedInState = reducer(undefined, signInDemoUser());

    expect(signedInState.user).toEqual({
      id: 'demo-user',
      name: 'Demo Coordinator',
      email: 'coordinator@example.com',
    });

    expect(reducer(signedInState, signOut()).user).toBeNull();
  });
});
