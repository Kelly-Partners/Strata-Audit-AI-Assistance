/**
 * Azure Authentication Service - replaces Firebase Auth
 * Uses Microsoft Authentication Library (MSAL) for browser-based auth.
 *
 * Uses REDIRECT flow (not popup) to avoid Cross-Origin-Opener-Policy issues
 * on Azure Static Web Apps. The full page redirects to Microsoft login,
 * then back to the app. handleRedirectPromise() processes the auth code
 * on return and fires MSAL events that onAuthStateChanged picks up.
 *
 * Environment variables:
 * - VITE_AZURE_AD_CLIENT_ID: App registration client ID
 * - VITE_AZURE_AD_TENANT_ID: Tenant ID (or B2C tenant name)
 * - VITE_AZURE_AD_AUTHORITY: Authority URL (optional, defaults to tenant)
 * - VITE_AZURE_AD_REDIRECT_URI: Redirect URI (optional, defaults to window.location.origin)
 */

import {
  PublicClientApplication,
  type Configuration,
  type AccountInfo,
  type AuthenticationResult,
  InteractionRequiredAuthError,
  EventType,
} from "@azure/msal-browser";

const env = import.meta.env;

const clientId = (env.VITE_AZURE_AD_CLIENT_ID as string) ?? "";
const tenantId = (env.VITE_AZURE_AD_TENANT_ID as string) ?? "";
const authority =
  (env.VITE_AZURE_AD_AUTHORITY as string) ||
  (tenantId
    ? `https://login.microsoftonline.com/${tenantId}`
    : "https://login.microsoftonline.com/common");
const redirectUri =
  (env.VITE_AZURE_AD_REDIRECT_URI as string) || window.location.origin;

export const hasValidAzureAuthConfig = !!(clientId && tenantId);

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL - must be called once before any other MSAL operations
let msalInitialized = false;
export async function initializeMsal(): Promise<void> {
  if (msalInitialized) return;
  await msalInstance.initialize();
  // Handle redirect response — this processes the auth code when the page
  // comes back from Microsoft login. Returns null if no redirect happened.
  await msalInstance.handleRedirectPromise();
  msalInitialized = true;
}

/**
 * Get the current authenticated account (if any).
 */
export function getCurrentAccount(): AccountInfo | null {
  const accounts = msalInstance.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function (mirrors Firebase onAuthStateChanged pattern).
 */
export function onAuthStateChanged(
  callback: (account: AccountInfo | null) => void
): () => void {
  // Fire immediately with current account
  callback(getCurrentAccount());

  // Listen for MSAL events
  const callbackId = msalInstance.addEventCallback((event) => {
    if (
      event.eventType === EventType.LOGIN_SUCCESS ||
      event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
      event.eventType === EventType.SSO_SILENT_SUCCESS
    ) {
      const result = event.payload as AuthenticationResult;
      callback(result.account);
    } else if (
      event.eventType === EventType.LOGOUT_SUCCESS ||
      event.eventType === EventType.LOGIN_FAILURE
    ) {
      callback(null);
    }
  });

  return () => {
    if (callbackId) {
      msalInstance.removeEventCallback(callbackId);
    }
  };
}

/**
 * Sign in with Microsoft via redirect flow.
 * The page navigates to Microsoft login and returns with auth code.
 * Does NOT return AccountInfo — the auth state update happens via
 * handleRedirectPromise → MSAL events → onAuthStateChanged callback.
 */
export async function signInWithPopup(): Promise<AccountInfo> {
  // Using redirect flow despite the function name (kept for backward compat).
  // loginRedirect navigates away; when the page returns, handleRedirectPromise
  // processes the result and fires LOGIN_SUCCESS which onAuthStateChanged picks up.
  await msalInstance.loginRedirect({
    scopes: ["openid", "profile", "email"],
  });
  // This line is never reached (page navigates away), but satisfies the type.
  return null as unknown as AccountInfo;
}

/**
 * Get an ID token for API calls (replaces Firebase getIdToken).
 * Uses the idToken rather than accessToken because this SPA and its
 * Azure Functions backend share the same Entra ID app registration.
 * The idToken has audience = clientId and contains the `oid` claim.
 */
export async function getAccessToken(): Promise<string> {
  const account = getCurrentAccount();
  if (!account) throw new Error("No authenticated user.");

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: ["openid", "profile", "email"],
      account,
    });
    return result.idToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Redirect for re-authentication instead of popup
      await msalInstance.acquireTokenRedirect({
        scopes: ["openid", "profile", "email"],
        account,
      });
      // Never reached (page navigates away)
      throw new Error("Redirecting for authentication...");
    }
    throw error;
  }
}

/**
 * Sign out the current user via redirect.
 */
export async function signOutUser(): Promise<void> {
  const account = getCurrentAccount();
  if (account) {
    await msalInstance.logoutRedirect({ account });
  }
}

/**
 * Adapter type to match the shape App.tsx expects.
 * Maps MSAL AccountInfo to a simplified user type.
 */
export interface AzureUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * Convert MSAL AccountInfo to our simplified user type.
 */
export function toAzureUser(account: AccountInfo | null): AzureUser | null {
  if (!account) return null;
  return {
    uid: account.localAccountId || account.homeAccountId,
    email: account.username || null,
    displayName: account.name || null,
  };
}
