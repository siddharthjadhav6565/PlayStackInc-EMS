import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 10;

export const hashPassword = (password: string) =>
  bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (
  password: string,
  hash: string
) => bcrypt.compare(password, hash);

export const signToken = (
  id: string,
  role: string
) =>
  jwt.sign(
    { id, role },
    process.env.JWT_SECRET || "",
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    } as jwt.SignOptions
  );

import { Response } from "express";

export const success = (
  res: Response,
  message: string,
  data: unknown = null,
  status = 200
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const error = (
  res: Response,
  message: string,
  status = 400,
  errors?: unknown
) => {
  return res.status(status).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
};

