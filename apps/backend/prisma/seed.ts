import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import { TEMPLATES } from './templates.js';

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

  // Seed Sprint F onboarding templates. The composite unique index
  // (name, createdBy) lets us upsert public templates where createdBy is
  // NULL — Prisma represents that as a null-safe composite key match.
  for (const tmpl of TEMPLATES) {
    const data = {
      name: tmpl.name,
      description: tmpl.description,
      category: tmpl.category,
      method: tmpl.method,
      sampleQuestions: JSON.stringify(tmpl.sampleQuestions),
      sampleTranscript: tmpl.sampleTranscript,
      sampleMemos: tmpl.sampleMemos ? JSON.stringify(tmpl.sampleMemos) : null,
      isPublic: true,
    };

    // findFirst + create-or-update because Prisma can't express a composite
    // unique upsert when one side is nullable (createdBy: null). This is
    // idempotent: re-running the seed updates content but doesn't dupe.
    const existing = await prisma.canvasTemplate.findFirst({
      where: { name: tmpl.name, createdBy: null },
    });
    if (existing) {
      await prisma.canvasTemplate.update({ where: { id: existing.id }, data });
    } else {
      await prisma.canvasTemplate.create({ data });
    }
  }

  console.log(`Seed complete. Demo code: CANVAS-DEMO2025 (+ ${TEMPLATES.length} onboarding templates)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
