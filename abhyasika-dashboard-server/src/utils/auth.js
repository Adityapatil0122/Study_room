import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { config } from "../config/env.js";

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function signStudentAuthToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.studentJwtExpiresIn,
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function createTemporaryPassword() {
  return randomBytes(6).toString("hex");
}
