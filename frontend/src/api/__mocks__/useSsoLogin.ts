export const useSsoLogin = jest.fn(() => ({
  loginWithGoogle: jest.fn(),
  loginWithMicrosoft: jest.fn(),
  ssoLoading: null,
}));
