import { prisma } from '../config/prisma.js';
import { auditService } from '../modules/admin/audit.service.js';

async function main() {
  const args = process.argv.slice(2);
  let userId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user-id' && args[i + 1]) {
      userId = args[i + 1];
      break;
    }
    if (args[i].startsWith('--user-id=')) {
      userId = args[i].split('=')[1];
      break;
    }
  }

  if (!userId) {
    console.error('❌ Error: Missing required --user-id argument.');
    console.error('Usage: npm run admin:grant -- --user-id <SUPABASE_USER_UUID>');
    process.exit(1);
  }

  console.log(`🔍 Checking user with ID: ${userId}...`);

  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
  });

  if (!user) {
    console.error(`❌ Error: UserProfile not found for ID "${userId}".`);
    console.error('Please ensure the user has signed in with Supabase Auth first.');
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.displayName} (@${user.username})`);

  // Upsert ADMIN role
  const role = await prisma.appRole.upsert({
    where: {
      userId_role: {
        userId,
        role: 'ADMIN',
      },
    },
    update: {},
    create: {
      userId,
      role: 'ADMIN',
      assignedBy: 'SYSTEM_BOOTSTRAP_CLI',
    },
  });

  // Record immutable audit event
  await auditService.logAction(
    null,
    'ROLE_GRANTED',
    'USER',
    userId,
    {
      role: 'ADMIN',
      mechanism: 'CLI_BOOTSTRAP',
      assignedTo: user.username,
    }
  );

  console.log(`✅ Success! User "${user.displayName}" (@${user.username}) is now an authorized ADMIN.`);
  console.log(`Role record ID: ${role.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Unexpected bootstrap error:', err);
  process.exit(1);
});

