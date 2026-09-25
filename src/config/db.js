import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import dotenv from 'dotenv';

// Load environmental parameters
dotenv.config();

const connectionString = process.env.DATABASE_URL;

// Parse MySQL/MariaDB URL details: mysql://user:password@host:port/database
const parseConnectionString = (url) => {
  if (!url) {
    throw new Error('DATABASE_URL connection string is missing.');
  }

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: parsed.username || 'root',
      password: decodeURIComponent(parsed.password) || '',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : 'medcare_billing',
    };
  } catch (error) {
    console.error('DATABASE_URL parsing error:', error);
    return {
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: '',
      database: 'medcare_billing',
    };
  }
};

const dbConfig = parseConnectionString(connectionString);

console.log(`🔌 Database connection configuration: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} (User: ${dbConfig.user})`);

// Initialize the Prisma MariaDB adapter
const adapter = new PrismaMariaDb({
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  connectionLimit: 5,
});

// Create and export the Prisma Client
export const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'], // Only log warnings and errors to keep terminal logs clean and quiet
});

