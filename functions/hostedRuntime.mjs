export function validateHostedRuntime(env, request) {
  if (env.ORVEX_RUNTIME_MODE !== 'hosted-beta' ||
      (env.GCLOUD_PROJECT || env.GCP_PROJECT) !== 'orvex-2f496' ||
      env.FUNCTIONS_EMULATOR || env.FIRESTORE_EMULATOR_HOST ||
      env.FIREBASE_AUTH_EMULATOR_HOST || !request?.app?.appId) {
    throw new Error('Unapproved hosted runtime');
  }
}
