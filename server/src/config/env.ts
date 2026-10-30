import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().optional().default(''),
  DIRECT_URL: z.string().optional().default(''),
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL (e.g. https://<project>.supabase.co)' }),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, { message: 'SUPABASE_PUBLISHABLE_KEY is required' }),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment configuration error:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

export const env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: 'test' as const,
      PORT: 4000,
      DATABASE_URL: '',
      DIRECT_URL: '',
      SUPABASE_URL: 'https://lpdyurstagyfatpqcfxz.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      FRONTEND_URL: 'http://localhost:5173',
    };

