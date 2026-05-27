import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || '', {
  ssl: process.env.DATABASE_URL?.includes('sslmode=disable') ? false : 'require',
});

export default sql;