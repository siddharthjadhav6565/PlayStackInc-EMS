import { z } from "zod";

export const roleValues = [
  "SUPER_ADMIN",
  "HR_MANAGER",
  "EMPLOYEE",
] as const;

export const statusValues = ["ACTIVE", "INACTIVE"] as const;

const optionalManagerId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (!value || value.trim() === "") return null;
    return value.trim();
  });

const employeeBaseSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(2, "Employee ID must contain at least 2 characters")
    .max(50),

  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(100),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),

  phone: z
    .string()
    .trim()
    .min(8, "Phone number must contain at least 8 characters")
    .max(20),

  department: z
    .string()
    .trim()
    .min(2, "Department is required")
    .max(100),

  designation: z
    .string()
    .trim()
    .min(2, "Designation is required")
    .max(100),

  salary: z.coerce
    .number()
    .finite("Salary must be a valid number")
    .min(0, "Salary cannot be negative"),

  joiningDate: z.coerce.date(),

  role: z.enum(roleValues),

  status: z.enum(statusValues),

  managerId: optionalManagerId,

  profileImage: z
    .string()
    .trim()
    .url("Profile image must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((value) => value || null),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createEmployeeSchema = employeeBaseSchema.extend({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100),
});

export const updateEmployeeSchema = employeeBaseSchema.extend({
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(100)
    .optional()
    .or(z.literal("")),
});

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(statusValues),
});