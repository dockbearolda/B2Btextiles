import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
  await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await hash(password);
    await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
    });
    console.log(`Admin prêt : ${email}`);
  } else {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD non définis — seed admin ignoré.');
  }
}
main().finally(() => prisma.$disconnect());
