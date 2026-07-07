export const useSsoLogin = jest.fn(() => ({
  loginWithGoogle: jest.fn(),
  loginWithMicrosoft: jest.fn(),
  ssoLoading: null,
  ssoError: null,
  clearSsoError: jest.fn(),
}));
