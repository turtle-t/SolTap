import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// This is the serverless-friendly query function.
// Each call is a single HTTP request to Neon — no long-lived connection
// to manage, which avoids the "too many connections" problem serverless
// functions normally hit with traditional Postgres clients.
export const sql = neon(process.env.DATABASE_URL);