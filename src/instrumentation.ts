export async function onRequestError() {
  // Required export for instrumentation
}

export async function register() {
  // Only run migrations on the server (not edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { runMigrations } = await import('@/lib/sourcing-db/migrate');
      await runMigrations();
    } catch (err) {
      console.warn('[instrumentation] Sourcing DB migration skipped:', (err as Error).message);
    }
  }
}
