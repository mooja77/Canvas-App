import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function main() {
  // Create a demo dashboard access code
  const demoCode = 'CANVAS-DEMO2025';
  const sha256Index = sha256(demoCode);
  const bcryptHash = await bcrypt.hash(demoCode, 12);

  await prisma.dashboardAccess.upsert({
    where: { accessCode: sha256Index },
    update: {},
    create: {
      accessCode: sha256Index,
      accessCodeHash: bcryptHash,
      name: 'Demo Researcher',
      role: 'researcher',
      expiresAt: new Date('2027-12-31'),
    },
  });

  console.log('Seed complete. Demo code: CANVAS-DEMO2025');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
