import { createYoga, YogaInitialContext } from 'graphql-yoga';
import schema from './graphql_schema';
import { prisma } from './prisma';
import jwt from 'jsonwebtoken';
import { Context } from './graphql_types';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key_here';

const context = async ({ request }: YogaInitialContext): Promise<Context> => {
    // @ts-expect-error cookies are present in the request object
    const token = request.cookies?.auth_token;
    let user = null;

    if (token) {
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

export const yoga = createYoga({
    graphqlEndpoint: "/api/graphql",
    schema,
    context,
});

