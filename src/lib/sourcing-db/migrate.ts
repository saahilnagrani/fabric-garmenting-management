import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

/**
 * Splits SQL text into individual statements, correctly handling
 * $$ ... $$ blocks (PL/pgSQL function bodies) and -- line comments.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarBlock = false;
  let i = 0;

  while (i < sql.length) {
    // Skip -- line comments (only outside $$ blocks)
    if (!inDollarBlock && sql[i] === '-' && sql[i + 1] === '-') {
      const newline = sql.indexOf('\n', i);
      i = newline === -1 ? sql.length : newline + 1;
      continue;
    }

    // Detect $$ delimiter
    if (sql[i] === '$' && sql[i + 1] === '$') {
      current += '$$';
      i += 2;
      inDollarBlock = !inDollarBlock;
      continue;
    }

    // Statement terminator (only outside $$ blocks)
    if (!inDollarBlock && sql[i] === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  // Don't forget the last statement (if no trailing semicolon)
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

/**
 * Runs the migration SQL against the database.
 * Safe to call multiple times - checks if tables exist first.
 */
export async function runMigrations() {
  const databaseUrl = process.env.NEON_DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes('your-neon-host')) {
    console.warn('[db] Skipping migrations: DATABASE_URL not configured');
    return;
  }

  const sql = neon(databaseUrl);

  try {
    // Check if tables already exist
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'suppliers'
      ) as exists
    `;

    if (result[0]?.exists) {
      console.log('[db] Tables already exist, skipping initial migration');
      // Still check for newer tables that may need to be added
      await ensureDiscoveryJobsTable(sql);
      return;
    }

    console.log('[db] Running initial migration...');

    const migrationPath = path.join(process.cwd(), 'src', 'lib', 'sourcing-db', 'migrations.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    const statements = splitStatements(migrationSql);

    for (const statement of statements) {
      try {
        await sql.query(statement);
      } catch (err: unknown) {
        const error = err as { message?: string };
        if (error.message?.includes('already exists')) {
          continue;
        }
        console.error('[db] Failed statement:', statement.slice(0, 80) + '...');
        throw err;
      }
    }

    console.log('[db] Migration completed successfully');

    // Check for discovery_jobs table and create if missing
    await ensureDiscoveryJobsTable(sql);
  } catch (err) {
    console.error('[db] Migration failed:', err);
    throw err;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureDiscoveryJobsTable(sql: any) {
  const result = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'discovery_jobs'
    ) as exists
  `;

  if (result[0]?.exists) {
    return;
  }

  console.log('[db] Creating discovery_jobs table...');

  const discoveryStatements = [
    `CREATE TYPE discovery_job_status AS ENUM ('pending', 'running', 'completed', 'failed')`,
    `CREATE TABLE discovery_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      material_ids JSONB NOT NULL,
      status discovery_job_status NOT NULL DEFAULT 'pending',
      results JSONB,
      error TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX idx_discovery_jobs_status ON discovery_jobs (status)`,
  ];

  for (const statement of discoveryStatements) {
    try {
      await sql.query(statement);
    } catch (err: unknown) {
      const error = err as { message?: string };
      if (error.message?.includes('already exists')) {
        continue;
      }
      console.error('[db] Failed statement:', statement.slice(0, 80) + '...');
      throw err;
    }
  }

  console.log('[db] discovery_jobs table created successfully');
}
