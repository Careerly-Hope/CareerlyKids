import { PrismaClient, RIASECCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface QuestionCSV {
  id: string;
  category: string;
  text: string;
  is_active: string;
  created_at: string;
  updated_at: string;
}

interface CareerProfileCSV {
  id: string;
  careerName: string;
  profile: string;
  jobZone: string;
  jobTier: string;
  description: string;
  onetCode: string;
  tags: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Read CSV files
  const questionsPath = path.join(__dirname, 'data', 'questions.csv');
  const careersPath = path.join(__dirname, 'data', 'career_profiles.csv');

  // Import Questions
  if (fs.existsSync(questionsPath)) {
    console.log('📝 Importing questions...');
    const questionsCSV = fs.readFileSync(questionsPath, 'utf-8');
    const questionsData = parse(questionsCSV, {
      columns: true,
      skip_empty_lines: true,
    }) as QuestionCSV[];

    for (const row of questionsData) {
      await prisma.question.upsert({
        where: { id: parseInt(row.id) },
        update: {},
        create: {
          id: parseInt(row.id),
          category: row.category as RIASECCategory,
          text: row.text,
          isActive: row.is_active === 't' || row.is_active === 'true',
        },
      });
    }
    console.log(`✅ Imported ${questionsData.length} questions`);
  } else {
    console.log('⚠️  questions.csv not found, skipping...');
  }

  // Import Career Profiles
  if (fs.existsSync(careersPath)) {
    console.log('💼 Importing career profiles...');
    const careersCSV = fs.readFileSync(careersPath, 'utf-8');
    const careersData = parse(careersCSV, {
      columns: true,
      skip_empty_lines: true,
    }) as CareerProfileCSV[];

    for (const row of careersData) {
      // Parse tags (PostgreSQL array format: {tag1,tag2})
      let tags: string[] = [];
      if (row.tags) {
        const tagsStr = row.tags.replace(/[{}]/g, '');
        tags = tagsStr.split(',').filter(t => t.trim());
      }

      await prisma.careerProfile.upsert({
        where: { id: parseInt(row.id) },
        update: {},
        create: {
          id: parseInt(row.id),
          careerName: row.careerName,                
          profile: JSON.parse(row.profile),
          jobZone: parseInt(row.jobZone),            
          jobTier: parseInt(row.jobTier),            
          description: row.description,
          onetCode: row.onetCode || null,            
          tags: tags,
          isActive: row.isActive === 't' || row.isActive === 'true',
        },
      });
    }
    console.log(`✅ Imported ${careersData.length} career profiles`);
  } else {
    console.log('⚠️  career_profiles.csv not found, skipping...');
  }

  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });