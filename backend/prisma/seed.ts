import bcrypt from "bcrypt";
import { PrismaClient } from "../src/generator/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  const exists = await prisma.employee.findUnique({
    where: {
      email: "admin@ems.com",
    },
  });

  if (exists) {
    console.log("Super Admin already exists.");
    return;
  }

  await prisma.employee.create({
    data: {
      employeeId: "EMP0001",
      name: "Super Admin",
      email: "admin@ems.com",
      password: await bcrypt.hash("Admin@123", 10),
      phone: "9999999999",
      department: "Administration",
      designation: "Super Admin",
      salary: "100000",
      joiningDate: new Date(),
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Super Admin created.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });