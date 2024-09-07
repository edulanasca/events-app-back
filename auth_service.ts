import { User } from '@prisma/client';
import { prisma } from './prisma';

export interface AuthService {
  findUserByEmail: (email: string) => Promise<User | null>;
  createUser: (name: string, email: string, password: string) => Promise<User>;
}

export const authService: AuthService = {
  findUserByEmail: async (email: string) => {
    return prisma.user.findUnique({
      where: { email },
    });
  },
  createUser: async (name: string, email: string, password: string) => {
    return prisma.user.create({
      data: { name, email, password },
    });
  },
};