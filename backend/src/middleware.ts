import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Prisma } from "./generator/client";
import { ZodError } from "zod";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { error } from "./utils";

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
    }
}
export const errorHandler = (
  err: any,
  _: any,
  res: any,
  __: any
) => {
  console.error(err);

  if (err instanceof ApiError)
    return error(res, err.message, err.status);

  if (err instanceof ZodError)
    return error(
      res,
      "Validation failed",
      422,
      err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }))
    );

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return error(res, "Resource already exists", 409);

      case "P2025":
        return error(res, "Resource not found", 404);

      default:
        return error(res, "Database error", 500);
    }
  }

  if (
    err instanceof JsonWebTokenError ||
    err instanceof TokenExpiredError
  ) {
    return error(res, "Invalid or expired token", 401);
  }

  return error(
    res,
    "Internal server error",
    500
  );
};

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    req.user = jwt.verify(
      auth.split(" ")[1],
      process.env.JWT_SECRET!
    ) as {
      id: string;
      role: string;
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

export const authorize =
  (...roles: string[]) =>
  (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    next();
  };

  