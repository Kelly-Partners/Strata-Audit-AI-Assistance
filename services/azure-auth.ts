/**
 * Re-export Azure auth for App and components.
 */
export {
  hasValidAzureAuthConfig,
  msalInstance,
  initializeMsal,
  getCurrentAccount,
  onAuthStateChanged,
  signInWithPopup,
  signOutUser,
  getAccessToken,
  toAzureUser,
} from "../src/services/azure-auth";
export type { AzureUser } from "../src/services/azure-auth";
