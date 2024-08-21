import { createSchema } from 'graphql-yoga';
import { Context } from './graphql_types';
import { prisma } from './prisma';
import { Category, EventParticipant } from '@prisma/client';

const typeDefs = `
type Query {
    me: User
    event(id: Int!, includeOrganizer: Boolean, includeParticipants: Boolean, includeCategories: Boolean): Event
    events(includeOrganizer: Boolean, includeParticipants: Boolean, includeCategories: Boolean, skip: Int, take: Int): [Event]
    participants(eventId: Int!, includeUser: Boolean, includeEvent: Boolean): [EventParticipant]
    categories: [Category]
    userEvents(userId: String!, includeOrganizer: Boolean, includeParticipants: Boolean, includeCategories: Boolean): [Event]
    userOrganizedEvents(userId: String!, includeOrganizer: Boolean, includeParticipants: Boolean, includeCategories: Boolean): [Event]
    checkApprovalStatus(eventId: Int!): EventParticipant
    eventParticipants(eventId: Int!): [EventParticipant]
}

type Mutation {
    createEvent(title: String!, description: String, date: String, location: String, isVirtual: Boolean!, maxAttendees: Int!, requiresApproval: Boolean!): Event
    editEvent(id: Int!, title: String, description: String, date: String, location: String, isVirtual: Boolean, maxAttendees: Int, requiresApproval: Boolean): Event
    deleteEvent(id: Int!): Event
    createParticipant(eventId: Int!, userId: String!): EventParticipant
    editParticipant(id: Int!, userId: String, eventId: Int, approved: Boolean): EventParticipant
    deleteParticipant(id: Int!): EventParticipant
    createCategory(name: String!): Category
    editCategory(id: Int!, name: String!): Category
    deleteCategory(id: Int!): Category
    addCategoryToEvent(eventId: Int!, categoryId: Int!): Event
    approveUser(eventId: Int!, userId: String!): EventParticipant
    joinEvent(eventId: Int!): EventParticipant
    toggleParticipantApproval(id: Int!, approved: Boolean!): EventParticipant
}

type Event {
    id: Int!
    title: String!
    description: String
    date: String
    location: String
    isVirtual: Boolean
    organizer: User!
    organizerId: String!
    maxAttendees: Int
    requiresApproval: Boolean
    participants: [EventParticipant]
    categories: [Category]
}

type User {
    id: String!
    name: String
    email: String!
    organizedEvents: [Event]
    eventParticipants: [EventParticipant]
}

type EventParticipant {
    id: Int!
    user: User!
    event: Event!
    approved: Boolean!
}

type Category {
    id: Int!
    name: String!
    events: [Event]
}
`;

const resolvers = {
    Query: {
        me: async (_: unknown, __: unknown, context: Context) => {
            return context.user;
        },
        event: async (_: unknown, { id, includeOrganizer, includeParticipants, includeCategories }: { id: number, includeOrganizer?: boolean, includeParticipants?: boolean, includeCategories?: boolean }) => {
            return await prisma.event.findUnique({
                where: { id },
                include: {
                    organizer: includeOrganizer || false,
                    eventParticipants: includeParticipants || false,
                    categories: includeCategories || false
                }
            });
        },
        events: async (_: unknown, { includeOrganizer, includeParticipants, includeCategories, skip, take }: { includeOrganizer?: boolean, includeParticipants?: boolean, includeCategories?: boolean, skip?: number, take?: number }) => {
            return await prisma.event.findMany({
                include: {
                    organizer: includeOrganizer || false,
                    eventParticipants: includeParticipants || false,
                    categories: includeCategories || false
                },
                skip: skip || 0,
                take: take || 10
            });
        },
        participants: async (_: unknown, { eventId, includeUser, includeEvent }: { eventId: number, includeUser?: boolean, includeEvent?: boolean }) => {
            return await prisma.eventParticipant.findMany({
                where: { eventId },
                include: {
                    user: includeUser || false,
                    event: includeEvent || false
                }
            });
        },
        categories: async () => {
            return await prisma.category.findMany();
        },
        userEvents: async (_: unknown, { userId, includeOrganizer, includeParticipants, includeCategories }: { userId: string, includeOrganizer?: boolean, includeParticipants?: boolean, includeCategories?: boolean }) => {
            return await prisma.event.findMany({
                where: {
                    eventParticipants: {
                        some: {
                            userId
                        }
                    },
                },
                include: {
                    organizer: includeOrganizer || false,
                    eventParticipants: includeParticipants || false,
                    categories: includeCategories || false
                }
            });
        },
        userOrganizedEvents: async (_: unknown, { userId, includeOrganizer, includeParticipants, includeCategories }: { userId: string, includeOrganizer?: boolean, includeParticipants?: boolean, includeCategories?: boolean }) => {
            return await prisma.event.findMany({
                where: {
                    organizerId: userId
                },
                include: {
                    eventParticipants: includeParticipants || false,
                    categories: includeCategories || false,
                    organizer: includeOrganizer || false
                }
            });
        },
        checkApprovalStatus: async (_: unknown, { eventId }: { eventId: number }, context: Context) => {
            if (!context.user) {
                throw new Error("Not authenticated");
            }
            return await prisma.eventParticipant.findFirst({
                where: {
                    eventId,
                    userId: context.user.id
                }
            });
        },
        eventParticipants: async (_: unknown, { eventId }: { eventId: number }) => {
            return await prisma.eventParticipant.findMany({
                where: { eventId },
                include: {
                    user: true
                }
            });
        }
    },
    Mutation: {
        createEvent: async (_: unknown, args: { title: string, description?: string, date?: string, location?: string, isVirtual: boolean, maxAttendees: number, requiresApproval: boolean }, context: Context) => {
            if (!context.user) {
                throw new Error("Not authenticated");
            }
            return await prisma.event.create({
                data: {
                    title: args.title,
                    description: args.description,
                    date: args.date ? args.date : new Date().toISOString(),
                    location: args.location,
                    isVirtual: args.isVirtual,
                    maxAttendees: args.maxAttendees,
                    requiresApproval: args.requiresApproval,
                    organizerId: context.user.id,
                }
            });
        },
        editEvent: async (_: unknown, { id, ...args }: { id: number, [key: string]: unknown }) => {
            return await prisma.event.update({
                where: { id },
                data: args
            });
        },
        deleteEvent: async (_: unknown, { id }: { id: number }) => {
            return await prisma.event.delete({
                where: { id }
            });
        },
        createParticipant: async (_: unknown, args: EventParticipant) => {
            return await prisma.eventParticipant.create({
                data: args
            });
        },
        editParticipant: async (_: unknown, { id, ...args }: { id: number, [key: string]: unknown }) => {
            return await prisma.eventParticipant.update({
                where: { id },
                data: args
            });
        },
        deleteParticipant: async (_: unknown, { id }: { id: number }) => {
            return await prisma.eventParticipant.delete({
                where: { id }
            });
        },
        createCategory: async (_: unknown, args: Category) => {
            return await prisma.category.create({
                data: args
            });
        },
        editCategory: async (_: unknown, { id, ...args }: { id: number, [key: string]: unknown }) => {
            return await prisma.category.update({
                where: { id },
                data: args
            });
        },
        deleteCategory: async (_: unknown, { id }: { id: number }) => {
            return await prisma.category.delete({
                where: { id }
            });
        },
        addCategoryToEvent: async (_: unknown, { eventId, categoryId }: { eventId: number, categoryId: number }) => {
            return await prisma.event.update({
                where: { id: eventId },
                data: {
                    categories: {
                        connect: { id: categoryId }
                    }
                }
            });
        },
        approveUser: async (_: unknown, { eventId, userId }: { eventId: number, userId: string }) => {
            return await prisma.eventParticipant.updateMany({
                where: { eventId, userId },
                data: { approved: true }
            });
        },
        joinEvent: async (_: unknown, { eventId }: { eventId: number }, context: Context) => {
            if (!context.user) {
                throw new Error("Not authenticated");
            }
            return await prisma.eventParticipant.create({
                data: {
                    eventId,
                    userId: context.user.id,
                    approved: false
                }
            });
        },
        toggleParticipantApproval: async (_: unknown, { id, approved }: { id: number, approved: boolean }) => {
            return await prisma.eventParticipant.update({
                where: { id },
                data: { approved }
            });
        }
    }
};

const schema = createSchema<Context>({
    typeDefs,
    resolvers
});

export default schema;