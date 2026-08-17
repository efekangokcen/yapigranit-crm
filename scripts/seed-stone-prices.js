const { PrismaClient } = require('../src/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log("Seeding Stone Prices into Supabase...");
  
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in .env.local");
  }
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const jsonPath = path.join(__dirname, 'parsed_stone_prices.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found at: ${jsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Loaded ${data.length} stone price records from JSON.`);

    // Deduplicate on (marka, renk, kalinlikMm)
    const uniqueData = [];
    const seen = new Set();
    for (const item of data) {
      const key = `${item.marka.toUpperCase()}|||${item.renk.toUpperCase()}|||${item.kalinlikMm}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(item);
      }
    }
    console.log(`Deduplicated to ${uniqueData.length} unique stone price records.`);

    // Clear existing prices
    console.log("Clearing existing stone prices...");
    await prisma.stonePrice.deleteMany();

    // Batch insert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < uniqueData.length; i += chunkSize) {
      const chunk = uniqueData.slice(i, i + chunkSize);
      
      await prisma.stonePrice.createMany({
        data: chunk.map(item => ({
          kategori: item.kategori,
          marka: item.marka,
          renk: item.renk,
          kalinlikMm: item.kalinlikMm,
          fiyat: item.fiyat,
          paraBirimi: item.paraBirimi,
          boyut: item.boyut
        }))
      });
      
      console.log(`Seeded items ${i + 1} to ${Math.min(i + chunkSize, uniqueData.length)}...`);
    }

    console.log("SUCCESS! Seeding completed.");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
