import { drizzle } from 'drizzle-orm/mysql2';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

const result = await db.execute(sql.raw('SELECT * FROM users LIMIT 2'));

console.log('=== RAW RESULT ===');
console.log(JSON.stringify(result, null, 2));

console.log('\n=== RESULT TYPE ===');
console.log('Is Array:', Array.isArray(result));
console.log('Length:', result?.length);

if (result && result.length > 0) {
  console.log('\n=== FIRST ROW ===');
  console.log('Type:', typeof result[0]);
  console.log('Constructor:', result[0]?.constructor?.name);
  console.log('Keys:', Object.keys(result[0]));
  console.log('Values:', Object.values(result[0]));
  console.log('JSON:', JSON.stringify(result[0]));
}

process.exit(0);
