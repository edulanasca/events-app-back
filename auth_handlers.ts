import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key_here';

export const loginHandler = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      return res.status(404).json({ data: null, message: 'User does not exist', error: 'User does not exist' });
    }

    const isValid = await bcrypt.compare(password, user.password!);
    if (!isValid) {
      return res.status(401).json({ data: null, message: 'Invalid password', error: 'Invalid password' });
    }

    const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 3600,
    });

    return res.status(200).json({ data: { token }, message: 'Login successful', error: null });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ data: null, message: 'Login failed', error: 'Login failed' });
  }
};

export const registerHandler = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (user) {
      return res.status(409).json({ data: null, message: 'User already exists', error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 3600,
    });

    return res.status(201).json({ data: { token }, message: 'User registered successfully', error: null });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ data: null, message: 'Registration failed', error: 'Registration failed' });
  }
};