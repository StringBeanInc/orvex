// Legacy normal-port test setup must never mutate the user's emulator data.
export default async function(){throw new Error('Unsafe legacy emulator setup is disabled. Use npm run test:auth with isolated emulator ports and frontend 5176; see docs/emulator-safe-restart.md.');}
