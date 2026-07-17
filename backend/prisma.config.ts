import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';

// Explicitly load the environment variables from your .env file
dotenv.config();

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});