import dotenv from 'dotenv';
import { productionEnvSchema, baseEnvSchema } from './envValidator.js';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const envSchema = isProduction ? productionEnvSchema : baseEnvSchema;

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

