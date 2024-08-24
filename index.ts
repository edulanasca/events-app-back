import express from 'express';
import bodyParser from 'body-parser';
import { loginHandler, registerHandler } from './auth_handlers';
import { yoga } from './graphql_handler';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import cluster from 'cluster';
import os from 'os';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Restart the worker
  });
} else {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(cors({
      origin: process.env.FRONTEND_URL,
      credentials: true,
  }));
  app.use(cookieParser());
  app.use(bodyParser.json());

  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/register', registerHandler);
  app.use(yoga.graphqlEndpoint, yoga);

  app.listen(port, () => {
    console.log(`Worker ${process.pid} is running on port ${port}`);
  });
}