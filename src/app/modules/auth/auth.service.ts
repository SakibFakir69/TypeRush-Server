import { timingSafeEqual } from 'crypto';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../../lib/prisma.db.js";
import { redis } from "../../../config/redis-config.js";
import { generateOtp } from "../../../helpers/otp-code.js";
import { COOLDOWN, OTP_TTL } from "../../../const/auth.const.js";
import { hashOtp } from "../../../utils/auth/has-otp.js";
import sendOtpEmail from '../../../utils/otp/otp.js';
import generateResetToken from '../../../utils/auth/gen-token.js';

class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

const login = async (email: string, password: string) => {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new AuthError(400, "Invalid email or password");
  }

  const isCorrectPassword = await bcrypt.compare(password, user.password as string);
  if (!isCorrectPassword) {
    throw new AuthError(400, "Invalid email or password");
  }

  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET_FOR_ACCESS_TOKEN as string, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_SECRET_FOR_REFRESH_TOKEN as string, {
    expiresIn: "15d",
  });

  return { accessToken, refreshToken };
};

const issueAccessToken = async (email: string) => {
  const user = await prisma.user.findFirst({ where: { email } });

  const payload = {
    userId: user?.id,
    email: user?.email,
    name: user?.name,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET_FOR_ACCESS_TOKEN as string, {
    expiresIn: "15m",
  });

  return accessToken;
};

const requestPasswordReset = async (rawEmail: string) => {
  const email = rawEmail.trim().toLowerCase();
  const otpKey = `otp:reset:${email}`;
  const cooldownKey = `otp:cooldown:${email}`;

  const acquired = await redis.set(cooldownKey, '1', 'EX', COOLDOWN, 'NX');
  if (!acquired) {
    throw new AuthError(429, 'Please wait before requesting another OTP');
  }

  const user = await prisma.user.findFirst({ where: { email } });

  if (user) {
    const otp = generateOtp();
    await redis.set(otpKey, hashOtp(otp), 'EX', OTP_TTL);
    await redis.del(`otp:attempts:${email}`);

    try {
      await sendOtpEmail(email, otp);
    } catch (err) {
      await redis.del(otpKey, cooldownKey);
      throw err;
    }
  }
};

const resetPasswordWithToken = async (resetToken: string, password: string) => {
  const email = await redis.getdel(`reset:token:${hashOtp(resetToken)}`);
  if (!email) {
    throw new AuthError(400, 'Invalid or expired reset token');
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new AuthError(400, 'Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } });
  await redis.del(`refresh:${user.id}`);
};

const verifyEmailOtp = async (rawEmail: string, otp: string) => {
  const email = rawEmail.trim().toLowerCase();
  const otpKey = `otp:verify:${email}`;
  const attemptsKey = `otp:verify:attempts:${email}`;

  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) await redis.expire(attemptsKey, OTP_TTL);
  if (attempts > 5) {
    await redis.del(otpKey);
    throw new AuthError(429, 'Too many attempts. Request a new code');
  }

  const stored = await redis.get(otpKey);
  const a = Buffer.from(stored ?? '');
  const b = Buffer.from(hashOtp(otp));
  if (!stored || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AuthError(400, 'Invalid or expired code');
  }

  await redis.del(otpKey, attemptsKey);

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new AuthError(400, 'User not found');
  }

  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
};

const resendVerificationOtp = async (rawEmail: string) => {
  const email = rawEmail.trim().toLowerCase();
  const cooldownKey = `otp:verify:cooldown:${email}`;
  const acquired = await redis.set(cooldownKey, '1', 'EX', COOLDOWN, 'NX');
  if (!acquired) {
    throw new AuthError(429, 'Please wait before requesting another code');
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (user && !user.emailVerified) {
    const otp = generateOtp();
    await redis.set(`otp:verify:${email}`, hashOtp(otp), 'EX', OTP_TTL);
    await redis.del(`otp:verify:attempts:${email}`);
    await sendOtpEmail(email, otp).catch(err => console.error(err));
  }
};

const verifyResetOtp = async (rawEmail: string, otp: string) => {
  const email = rawEmail.trim().toLowerCase();
  const attemptsKey = `otp:attempts:${email}`;
  const otpKey = `otp:reset:${email}`;

  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) await redis.expire(attemptsKey, OTP_TTL);
  if (attempts > 5) {
    await redis.del(otpKey);
    throw new AuthError(429, 'Too many attempts. Request a new OTP');
  }

  const stored = await redis.get(otpKey);
  const a = Buffer.from(stored ?? '');
  const b = Buffer.from(hashOtp(otp));
  if (!stored || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AuthError(400, 'Invalid or expired OTP');
  }

  await redis.del(otpKey, attemptsKey);

  const resetToken = generateResetToken();
  const resetTokenKey = `reset:token:${hashOtp(resetToken)}`;
  await redis.set(resetTokenKey, email, 'EX', 500);

  return resetToken;
};

export const AuthServices = {
  AuthError,
  login,
  issueAccessToken,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyEmailOtp,
  resendVerificationOtp,
  verifyResetOtp,
};