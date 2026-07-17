import { Router } from "express";
import { prisma } from "../prisma";
import { comparePassword, signToken } from "../utils";
import { loginSchema } from "../validation";
import { authenticate } from "../middleware";

const router = Router();

/*
POST /api/auth/login
*/

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      errors: parsed.error.issues,
    });
  }

  const { email, password } = parsed.data;

  const employee = await prisma.employee.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  });

  if (!employee) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  if (employee.status !== "ACTIVE") {
    return res.status(403).json({
      success: false,
      message: "Account inactive",
    });
  }

  const valid = await comparePassword(
    password,
    employee.password
  );

  if (!valid) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  const token = signToken(employee.id, employee.role);

  return res.json({
    success: true,
    token,
    user: {
      id: employee.id,
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      role: employee.role,
    },
  });
});

/*
GET /api/auth/me
*/

router.get("/me", authenticate, async (req: any, res) => {
  const employee = await prisma.employee.findUnique({
    where: {
      id: req.user.id,
    },
    omit: {
      password: true,
    },
  });

  res.json({
    success: true,
    data: employee,
  });
});

/*
POST /api/auth/logout
*/

router.post("/logout", authenticate, (_, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;