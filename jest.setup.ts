import { PrismaClient } from '@prisma/client';
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client/core';
import fetch from 'cross-fetch';

const prisma = new PrismaClient();
const client = new ApolloClient({
  link: new HttpLink({ uri: 'http://localhost:8080/api/graphql', fetch }),
  cache: new InMemoryCache(),
});

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma, client };