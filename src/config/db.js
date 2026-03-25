import { PrismaClient } from '@prisma/client';
import { ENV } from './env.js';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
