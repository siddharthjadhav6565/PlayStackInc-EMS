import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import { prisma } from "./prisma";

import authRoutes from "./routes/auth";
import employeeRoutes from "./routes/employees";

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/health", async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      status: "healthy",
      database: "connected",
      uptime: process.uptime(),
      timestamp: new Date(),
    });
  } catch {
    res.status(500).json({
      success: false,
      status: "unhealthy",
      database: "disconnected",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);

export default app;