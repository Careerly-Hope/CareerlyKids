// test-prisma.ts
// Run with: npx ts-node test-prisma.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testPrisma() {
  console.log('🔍 Testing Prisma connection...\n');

  try {
    // Test 1: Raw connection
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Test 2: Count questions
    const totalCount = await prisma.question.count();
    console.log(`📊 Total questions: ${totalCount}`);

    const activeCount = await prisma.question.count({
      where: { isActive: true },
    });
    console.log(`✅ Active questions: ${activeCount}`);

    const inactiveCount = await prisma.question.count({
      where: { isActive: false },
    });
    console.log(`❌ Inactive questions: ${inactiveCount}\n`);

    // Test 3: Fetch sample questions
    console.log('📝 Sample questions:');
    const samples = await prisma.question.findMany({
      take: 5,
      select: {
        id: true,
        text: true,
        category: true,
        isActive: true,
      },
    });
    console.log(JSON.stringify(samples, null, 2));

    // Test 4: Check database info
    console.log('\n🔍 Database info:');
    const dbInfo = await prisma.$queryRaw`
      SELECT 
        current_database() as database,
        current_schema() as schema,
        version() as pg_version
    `;
    console.log(JSON.stringify(dbInfo, null, 2));

    // Test 5: Check table structure
    console.log('\n🏗️  Questions table structure:');
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'questions'
      ORDER BY ordinal_position
    `;
    console.log(JSON.stringify(tableInfo, null, 2));

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();