/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_MICROSOFT_CLIENT_ID?: string;
  readonly VITE_MICROSOFT_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/* Google Identity Services (GSI) type declarations */
declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
    select_by: string;
    clientId?: string;
  }

  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    itp_support?: boolean;
    login_uri?: string;
    native_callback?: (response: CredentialResponse) => void;
    prompt_parent_id?: string;
    ux_mode?: 'popup' | 'redirect';
  }

  function initialize(config: IdConfiguration): void;
  function prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
  function renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
  function disableAutoSelect(): void;
  function revoke(hint: string, callback: (done: { successful: boolean; error?: string }) => void): void;

  interface PromptMomentNotification {
    isDisplayMoment(): boolean;
    isDisplayed(): boolean;
    isNotDisplayed(): boolean;
    getNotDisplayedReason(): string;
    isSkippedMoment(): boolean;
    getSkippedReason(): string;
    isDismissedMoment(): boolean;
    getDismissedReason(): string;
  }

  interface GsiButtonConfiguration {
    type: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: string;
    locale?: string;
  }
}
