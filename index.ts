import express from 'express';
import bodyParser from 'body-parser';
import { loginHandler, registerHandler, logoutHandler } from './auth_handlers';
import { yoga } from './graphql_handler';
import cookieParser from 'cookie-parser';
import cors from 'cors';

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
app.post('/api/auth/logout', logoutHandler);
app.use(yoga.graphqlEndpoint, yoga);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});