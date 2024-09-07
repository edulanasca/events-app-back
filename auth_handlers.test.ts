import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createAuthHandlers } from './auth_handlers';
import { prisma } from './prisma';
import { authService } from './auth_service';

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const { loginHandler, registerHandler } = createAuthHandlers(authService);

app.post('/api/auth/login', loginHandler);
app.post('/api/auth/register', registerHandler);

jest.mock('./prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('Auth Handlers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 404 if user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'pass123!' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User does not exist');
      expect(response.body.data).toBeNull();
      expect(response.body.message).toBe('User does not exist');
    });

    it('should return 401 if password is invalid', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com', password: 'hashedpassword' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'pass123!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid password');
      expect(response.body.data).toBeNull();
      expect(response.body.message).toBe('Invalid password');
    });

    it('should return 200 and set cookie if login is successful', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ email: 'test@example.com', password: 'hashedpassword' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(jwt, 'sign').mockReturnValue('token' as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'pass123!' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.error).toBeNull();
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 201 and set cookie if registration is successful', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Test', email: 'test@example.com', password: 'pass123!' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.error).toBeNull();
    });
  });
});