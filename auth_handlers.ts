import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as Yup from 'yup';
import { AuthService } from './auth_service';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key_here';

// Add the validation schema
const validationSchema = Yup.object().shape({
  name: Yup.string()
    .min(3, 'Name must be at least 3 characters')
    .max(20, 'Name must not exceed 20 characters')
    .when('isLogin', (isLogin, schema) => {
      return isLogin ? schema.notRequired() : schema.required('Name is required');
    }),
  email: Yup.string()
    .email('Invalid email')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .matches(/[a-zA-Z]/, 'Password must contain at least one letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .required('Password is required'),
});

export function createAuthHandlers(authService: AuthService) {
  return {
    loginHandler: async (req: Request, res: Response) => {
      try {
        // Validate input
        await validationSchema.validate(req.body, { abortEarly: false, context: { isLogin: true } });

        const { email, password } = req.body;

        const user = await authService.findUserByEmail(email);
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
        if (error instanceof Yup.ValidationError) {
          return res.status(400).json({ data: null, message: 'Validation failed', error: error.errors });
        }
        console.error('Login error:', error);
        return res.status(500).json({ data: null, message: 'Login failed', error: 'Login failed' });
      }
    },
    registerHandler: async (req: Request, res: Response) => {
      try {
        // Validate input
        await validationSchema.validate(req.body, { abortEarly: false, context: { isLogin: false } });

        const { name, email, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);
        await authService.createUser(name, email, hashedPassword);

        const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '1h' });

        res.cookie('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'none',
          maxAge: 3600,
        });

        return res.status(201).json({ data: { token }, message: 'User registered successfully', error: null });
      } catch (error) {
        if (error instanceof Yup.ValidationError) {
          return res.status(400).json({ data: null, message: 'Validation failed', error: error.errors });
        }
        console.error('Registration error:', error);
        return res.status(500).json({ data: null, message: 'Registration failed', error: 'Registration failed' });
      }
    }
  };
}