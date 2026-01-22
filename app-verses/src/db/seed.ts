import { db } from './client.ts';
import { users } from './schema/users.ts';
import { authService } from '../auth/auth-service.ts';
import { eq } from 'drizzle-orm';

async function seedAdmin() {
  const adminName = process.env.ADMIN_NAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminName || !adminPassword) {
    throw new Error('ADMIN_NAME e ADMIN_PASSWORD precisam estar definidos');
  }

  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.name, adminName))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log('Admin já existe, seed ignorado');
    return;
  }

  await authService.register(adminName, adminPassword, 'admin');

  console.log('Admin criado com sucesso');
}

seedAdmin()
  .then(() => {
    console.log('Seed finalizado');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Erro no seed:', err);
    process.exit(1);
  });
