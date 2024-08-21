import { User } from "@prisma/client";

export type CookieOptions = {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
};

export type Context = {
    user: User | null;
};