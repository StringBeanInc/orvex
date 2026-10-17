// Local preview only. An explicit false and the independent server gate still block signup.
export const publicSignupEnabled=(import.meta.env.DEV?import.meta.env.VITE_ENABLE_PUBLIC_SIGNUP!=='false':import.meta.env.VITE_FIREBASE_MODE==='hosted-beta'&&import.meta.env.VITE_ENABLE_PUBLIC_SIGNUP==='true');
