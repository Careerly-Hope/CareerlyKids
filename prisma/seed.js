"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const sync_1 = require("csv-parse/sync");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting seed...');
    const questionsPath = path.join(__dirname, 'data', 'questions.csv');
    const careersPath = path.join(__dirname, 'data', 'career_profiles.csv');
    if (fs.existsSync(questionsPath)) {
        console.log('📝 Importing questions...');
        const questionsCSV = fs.readFileSync(questionsPath, 'utf-8');
        const questionsData = (0, sync_1.parse)(questionsCSV, {
            columns: true,
            skip_empty_lines: true,
        });
        for (const row of questionsData) {
            await prisma.question.upsert({
                where: { id: parseInt(row.id) },
                update: {},
                create: {
                    id: parseInt(row.id),
                    category: row.category,
                    text: row.text,
                    isActive: ['t', 'true', '1', 'yes', 'y'].includes(row.is_active?.toString().trim().toLowerCase()),
                },
            });
        }
        console.log(`✅ Imported ${questionsData.length} questions`);
    }
    else {
        console.log('⚠️  questions.csv not found, skipping...');
    }
    if (fs.existsSync(careersPath)) {
        console.log('💼 Importing career profiles...');
        const careersCSV = fs.readFileSync(careersPath, 'utf-8');
        const careersData = (0, sync_1.parse)(careersCSV, {
            columns: true,
            skip_empty_lines: true,
        });
        for (const row of careersData) {
            let tags = [];
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
    }
    else {
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
//# sourceMappingURL=seed.js.map