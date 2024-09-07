import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import { createAuthHandlers } from './auth_handlers';
import { createGraphQLHandler } from './graphql_handler';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import cluster from 'cluster';
import os from 'os';
import { prisma } from './prisma';
import * as http from "http";
import { authService } from './auth_service';

class AppSingleton {
  private static instance: express.Application;

  private constructor() { }

  public static getInstance(): express.Application {
    if (!AppSingleton.instance) {
      AppSingleton.instance = express();
      AppSingleton.configureApp();
    }
    return AppSingleton.instance;
  }

  private static configureApp(): void {
    const app = AppSingleton.instance;
    app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
    }));
    app.use(cookieParser());
    app.use(bodyParser.json());

    prisma.$connect().then(() => {
      console.log('Connected to database');
    }).catch((error) => {
      console.error('Failed to connect to database', error);
    });
  }
}

const numCPUs = os.cpus().length;
let server: http.Server;

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Close server
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
    });
  }

  // Close database connections
  await prisma.$disconnect();

  // Close any other resources or connections here
  // For example, if you have a Redis client:
  // await redisClient.quit();

  console.log('All connections closed. Shutting down.');
  process.exit(0);
}

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.log(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
    }

    if (signal) {
      console.log(`Worker ${worker.process.pid} killed by signal ${signal}`);
    }

    console.log(`Restarting worker ${worker.process.pid}`);
    cluster.fork(); // Restart the worker
  });

  // Handle graceful shutdown for the primary process
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

} else {
  const app = AppSingleton.getInstance();
  const port = process.env.PORT || 3000;

  const { loginHandler, registerHandler } = createAuthHandlers(authService);
  const graphQLHandler = createGraphQLHandler();

  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/register', registerHandler);
  app.use(graphQLHandler.graphqlEndpoint, graphQLHandler);

  server = app.listen(port, () => {
    console.log(`Worker ${process.pid} is running on port ${port}`);
  });

  // Handle graceful shutdown for worker processes
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}