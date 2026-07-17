import { Router } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware";
import { hashPassword } from "../utils";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
} from "../validation";
import multer from "multer";  
import { parse } from "csv-parse/sync";

const router = Router();

router.use(authenticate);

const withoutPassword = {
  password: false,
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

function sendValidationError(res: any, parsed: any) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: parsed.error.issues,
  });
}

function parsePositiveInt(
  value: unknown,
  defaultValue: number,
  maximum: number
) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return defaultValue;
  }

  return Math.min(Math.floor(numberValue), maximum);
}
router.post("/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "CSV file is required",
    });
  }

  let rows: Record<string, string>[] = [];

  try {
    rows = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid CSV file format",
    });
  }

  const errors: Array<{ row: number; message: string }> = [];
  let created = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];

    const payload = {
      employeeId: row.employeeId,
      name: row.name,
      email: row.email,
      password: row.password,
      phone: row.phone,
      department: row.department,
      designation: row.designation,
      salary: Number(row.salary),
      joiningDate: row.joiningDate,
      role: row.role,
      status: row.status || "ACTIVE",
      managerId: row.managerId || null,
      profileImage: row.profileImage || null,
    };

    const parsed = createEmployeeSchema.safeParse(payload);

    if (!parsed.success) {
      errors.push({
        row: index + 2,
        message: parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join(", "),
      });
      continue;
    }

    const existing = await prisma.employee.findFirst({
      where: {
        OR: [
          { email: parsed.data.email },
          { employeeId: parsed.data.employeeId },
        ],
      },
    });

    if (existing) {
      errors.push({
        row: index + 2,
        message: "Employee ID or email already exists",
      });
      continue;
    }

    try {
      const { password, ...employeeData } = parsed.data;

      await prisma.employee.create({
        data: {
          ...employeeData,
          password: await hashPassword(password),
        },
      });

      created += 1;
    } catch {
      errors.push({
        row: index + 2,
        message: "Unable to create employee record",
      });
    }
  }

  return res.status(201).json({
    success: true,
    message: "CSV import completed",
    data: {
      created,
      failed: errors.length,
      errors,
    },
  });
});
//
// GET /api/employees/stats
//
router.get("/stats", async (_req, res) => {
  const [total, active, inactive, hrManagers, employees] = await Promise.all([
    prisma.employee.count({
      where: { deletedAt: null },
    }),

    prisma.employee.count({
      where: {
        deletedAt: null,
        status: "ACTIVE",
      },
    }),

    prisma.employee.count({
      where: {
        deletedAt: null,
        status: "INACTIVE",
      },
    }),

    prisma.employee.count({
      where: {
        deletedAt: null,
        role: "HR_MANAGER",
      },
    }),

    prisma.employee.count({
      where: {
        deletedAt: null,
        role: "EMPLOYEE",
      },
    }),
  ]);

  return res.json({
    success: true,
    data: {
      total,
      active,
      inactive,
      hrManagers,
      employees,
    },
  });
});

//
// GET /api/employees/me/reportees
//
router.get("/me/reportees", async (req: any, res) => {
  const reportees = await prisma.employee.findMany({
    where: {
      managerId: req.user.id,
      deletedAt: null,
    },
    orderBy: {
      name: "asc",
    },
    omit: withoutPassword,
  });

  return res.json({
    success: true,
    data: reportees,
  });
});

//
// GET /api/employees
//
router.get("/", async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1, 100000);
  const limit = parsePositiveInt(req.query.limit, 10, 100);

  const search = String(req.query.search || "").trim();
  const department = String(req.query.department || "").trim();
  const role = String(req.query.role || "").trim();
  const status = String(req.query.status || "").trim();

  const where: any = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        email: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        employeeId: {
          contains: search,
          mode: "insensitive",
        },
      },
    ];
  }

  if (department) {
    where.department = department;
  }

  if (["SUPER_ADMIN", "HR_MANAGER", "EMPLOYEE"].includes(role)) {
    where.role = role;
  }

  if (["ACTIVE", "INACTIVE"].includes(status)) {
    where.status = status;
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      omit: withoutPassword,
    }),

    prisma.employee.count({
      where,
    }),
  ]);

  return res.json({
    success: true,
    data: employees,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

//
// POST /api/employees
//
router.post("/", async (req, res) => {
  const parsed = createEmployeeSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed);
  }

  const { password, managerId, ...employeeData } = parsed.data;

  const duplicateEmployee = await prisma.employee.findFirst({
    where: {
      OR: [
        { email: employeeData.email },
        { employeeId: employeeData.employeeId },
      ],
    },
  });

  if (duplicateEmployee) {
    return res.status(409).json({
      success: false,
      message:
        duplicateEmployee.email === employeeData.email
          ? "Email address is already in use"
          : "Employee ID is already in use",
    });
  }

  if (managerId) {
    const manager = await prisma.employee.findFirst({
      where: {
        id: managerId,
        deletedAt: null,
      },
    });

    if (!manager) {
      return res.status(400).json({
        success: false,
        message: "Selected manager does not exist",
      });
    }
  }

  const employee = await prisma.employee.create({
    data: {
      ...employeeData,
      managerId,
      password: await hashPassword(password),
    },
    omit: withoutPassword,
  });

  return res.status(201).json({
    success: true,
    message: "Employee created successfully",
    data: employee,
  });
});

//
// GET /api/employees/:id
//
router.get("/:id", async (req, res) => {
  const employee = await prisma.employee.findFirst({
    where: {
      id: req.params.id,
      deletedAt: null,
    },
    include: {
      manager: {
        select: {
          id: true,
          employeeId: true,
          name: true,
          email: true,
          designation: true,
        },
      },
      reportees: {
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
          employeeId: true,
          name: true,
          email: true,
          designation: true,
          status: true,
        },
      },
    },
    omit: withoutPassword,
  });

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  return res.json({
    success: true,
    data: employee,
  });
});

//
// PUT /api/employees/:id
//
router.put("/:id", async (req, res) => {
  const parsed = updateEmployeeSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed);
  }

  const existingEmployee = await prisma.employee.findFirst({
    where: {
      id: req.params.id,
      deletedAt: null,
    },
  });

  if (!existingEmployee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  const { password, managerId, ...employeeData } = parsed.data;

  if (managerId === req.params.id) {
    return res.status(400).json({
      success: false,
      message: "An employee cannot be their own manager",
    });
  }

  const duplicateEmployee = await prisma.employee.findFirst({
    where: {
      id: {
        not: req.params.id,
      },
      OR: [
        { email: employeeData.email },
        { employeeId: employeeData.employeeId },
      ],
    },
  });

  if (duplicateEmployee) {
    return res.status(409).json({
      success: false,
      message:
        duplicateEmployee.email === employeeData.email
          ? "Email address is already in use"
          : "Employee ID is already in use",
    });
  }

  if (managerId) {
    const manager = await prisma.employee.findFirst({
      where: {
        id: managerId,
        deletedAt: null,
      },
    });

    if (!manager) {
      return res.status(400).json({
        success: false,
        message: "Selected manager does not exist",
      });
    }
  }

  const data: any = {
    ...employeeData,
    managerId,
  };

  if (password && password.trim()) {
    data.password = await hashPassword(password);
  }

  const employee = await prisma.employee.update({
    where: {
      id: req.params.id,
    },
    data,
    omit: withoutPassword,
  });

  return res.json({
    success: true,
    message: "Employee updated successfully",
    data: employee,
  });
});

//
// PATCH /api/employees/:id/status
//
router.patch("/:id/status", async (req, res) => {
  const parsed = updateEmployeeStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return sendValidationError(res, parsed);
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: req.params.id,
      deletedAt: null,
    },
  });

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  const updatedEmployee = await prisma.employee.update({
    where: {
      id: req.params.id,
    },
    data: {
      status: parsed.data.status,
    },
    omit: withoutPassword,
  });

  return res.json({
    success: true,
    message: "Employee status updated successfully",
    data: updatedEmployee,
  });
});

//
// DELETE /api/employees/:id
//
router.delete("/:id", async (req, res) => {
  const employee = await prisma.employee.findFirst({
    where: {
      id: req.params.id,
      deletedAt: null,
    },
  });

  if (!employee) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  await prisma.employee.update({
    where: {
      id: req.params.id,
    },
    data: {
      deletedAt: new Date(),
      status: "INACTIVE",
    },
  });

  return res.json({
    success: true,
    message: "Employee deleted successfully",
  });
});

export default router;