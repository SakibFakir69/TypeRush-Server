


import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  fullName: z.string().min(1).max(150),
  age: z.number().int().positive().max(120).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  country: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});


export const createUserSchema = userSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const updateUserSchema = createUserSchema.partial();

export type User = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;