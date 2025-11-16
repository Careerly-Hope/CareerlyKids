import { PrismaClient, RIASECCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface QuestionCSV {
  id: string;
  category: string;
  text: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
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
          isActive: ['t', 'true', '1', 'yes', 'y'].includes(
            row.isActive?.toString().trim().toLowerCase()
          ),
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
      relax_quotes: true,
      escape: '"',
      quote: '"'
    }) as CareerProfileCSV[];

    for (const row of careersData) {
      try {
        // Parse tags (PostgreSQL array format: {tag1,tag2} or ["tag1","tag2"])
        let tags: string[] = [];
        if (row.tags) {
          // Remove brackets and quotes, then split
          const tagsStr = row.tags
            .replace(/[\[\]{}]/g, '')
            .replace(/""""/g, '"')
            .replace(/"/g, '');
          tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        }

        // Clean and parse profile JSON
        let profileJson;
        let cleanProfile = row.profile;
        
        try {
          // Remove outer quotes if present
          cleanProfile = cleanProfile.replace(/^"/, '').replace(/"$/, '');
          
          // Replace all escaped quotes: "" -> "
          cleanProfile = cleanProfile.replace(/""/g, '"');
          
          profileJson = JSON.parse(cleanProfile);
        } catch (err) {
          console.error(`Failed to parse profile for ${row.careerName}:`, row.profile);
          console.error(`After cleaning:`, cleanProfile);
          throw err;
        }

        await prisma.careerProfile.upsert({
          where: { id: parseInt(row.id) },
          update: {},
          create: {
            id: parseInt(row.id),
            careerName: row.careerName,
            profile: profileJson,
            jobZone: parseInt(row.jobZone),
            jobTier: parseInt(row.jobTier),
            description: row.description,
            onetCode: row.onetCode || null,
            tags: tags,
            isActive: row.isActive === 't' || row.isActive === 'true',
          },
        });
      } catch (error) {
        console.error(`Error processing career profile ${row.id} (${row.careerName}):`, error);
        throw error;
      }
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