import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env first, then fallback to current working directory
dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

/**
 * Production environment validation schema
 */
export const productionEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required in production').refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    { message: 'DATABASE_URL must be a valid PostgreSQL connection string' }
  ),
  DIRECT_URL: z.string().min(1, 'DIRECT_URL is required in production').refine(
    (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
    { message: 'DIRECT_URL must be a valid direct PostgreSQL connection string' }
  ),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid HTTPS URL').refine(
    (url) => url.startsWith('https://'),
    { message: 'SUPABASE_URL must use HTTPS protocol' }
  ),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(10, 'SUPABASE_PUBLISHABLE_KEY is required and must be valid'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
});

/**
 * General environment schema for dev/test
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional().default(''),
  DIRECT_URL: z.string().optional().default(''),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'SUPABASE_PUBLISHABLE_KEY is required'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

export const KNOWN_CONFIG_KEYS = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'DIRECT_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'FRONTEND_URL',
] as const;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedConfig: Record<string, string>;
}

/**
 * Validate current environment variables without exposing sensitive secrets
 */
export function validateEnvironment(env: Record<string, string | undefined> = process.env): ValidationResult {
  const isProduction = env.NODE_ENV === 'production';
  const schema = isProduction ? productionEnvSchema : baseEnvSchema;
  const result = schema.safeParse(env);

  if (!result.success) {
    const errors = result.error.errors.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    );
    return {
      isValid: false,
      errors,
      sanitizedConfig: sanitizeEnv(env),
    };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedConfig: sanitizeEnv(result.data),
  };
}

/**
 * Mask sensitive credentials for safe logging, filtering only known application variables
 */
export function sanitizeEnv(env: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const key of KNOWN_CONFIG_KEYS) {
    const value = env[key];
    if (!value || typeof value !== 'string') {
      sanitized[key] = '[NOT SET]';
      continue;
    }

    const lower = key.toLowerCase();
    if (
      lower.includes('key') ||
      lower.includes('secret') ||
      lower.includes('password') ||
      lower.includes('token')
    ) {
      if (value.length > 8) {
        sanitized[key] = `${value.slice(0, 4)}...${value.slice(-4)}`;
      } else {
        sanitized[key] = '[REDACTED]';
      }
    } else if (key === 'DATABASE_URL' || key === 'DIRECT_URL') {
      try {
        const u = new URL(value);
        sanitized[key] = `${u.protocol}//${u.username}:****@${u.host}${u.pathname}`;
      } catch {
        sanitized[key] = '[REDACTED_POSTGRES_URL]';
      }
    } else {
      sanitized[key] = String(value);
    }
  }
  return sanitized;
}

// CLI runner
if (
  process.argv[1]?.endsWith('envValidator.ts') ||
  process.argv[1]?.endsWith('envValidator.js')
) {
  const result = validateEnvironment();
  console.log('--- PlaySpace Release Pre-flight: Environment Check ---');
  console.log('Sanitized Environment Configuration:');
  for (const [k, v] of Object.entries(result.sanitizedConfig)) {
    console.log(`  ${k}: ${v}`);
  }

  if (!result.isValid) {
    console.error('\n❌ Environment Validation Failed:');
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  } else {
    console.log('\n✅ Environment configuration is valid for current mode.');
    process.exit(0);
  }
}
