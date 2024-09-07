import { createYoga, YogaInitialContext } from 'graphql-yoga';
import schema from './graphql_schema';
import { prisma } from './prisma';
import jwt from 'jsonwebtoken';
import { Context } from './graphql_types';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key_here';

const context = async ({ request }: YogaInitialContext): Promise<Context> => {
    const authHeader = request.headers.get('Authorization');
    let user = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, SECRET_KEY) as { email: string };
            user = await prisma.user.findUnique({
                where: { email: decoded.email },
            });
        } catch (error) {
            console.error(error);
        }
    }

    return { user };
};

export function createGraphQLHandler() {
    // Create and configure your GraphQL handler
    return createYoga({
        graphqlEndpoint: "/api/graphql",
        schema,
        context,
    });
}