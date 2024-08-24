import dotenv from 'dotenv';
dotenv.config();

import { prisma, client } from './jest.setup';
import gql from 'graphql-tag';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key_here';

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

describe('Versioning Tests', () => {
  let eventId: number;
  let participantId: number;
  let categoryId: number;
  let userId: string;
  let authToken: string;

  beforeAll(async () => {
    // Create a user for testing
    const randomInt = getRandomInt(10000);
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: `testuser${randomInt}@example.com`,
        password: 'password123',
      },
    });
    userId = user.id;

    // Generate authentication token
    authToken = jwt.sign({ email: user.email }, SECRET_KEY);

    // Create initial records for testing
    const createEventMutation = gql`
      mutation CreateEvent($title: String!, $description: String, $date: String, $location: String, $isVirtual: Boolean!, $maxAttendees: Int!, $requiresApproval: Boolean!) {
        createEvent(title: $title, description: $description, date: $date, location: $location, isVirtual: $isVirtual, maxAttendees: $maxAttendees, requiresApproval: $requiresApproval) {
          id
          version
        }
      }
    `;
    const eventResponse = await client.mutate({
      mutation: createEventMutation,
      variables: {
        title: 'Test Event',
        description: 'Test Description',
        date: new Date().toISOString(),
        location: 'Test Location',
        isVirtual: false,
        maxAttendees: 100,
        requiresApproval: false,
      },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      //console.error('Error creating event:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    eventId = eventResponse.data.createEvent.id;

    const createParticipantMutation = gql`
      mutation CreateParticipant($eventId: Int!, $userId: String!) {
        createParticipant(eventId: $eventId, userId: $userId) {
          id
          version
        }
      }
    `;
    const participantResponse = await client.mutate({
      mutation: createParticipantMutation,
      variables: {
        eventId,
        userId,
      },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error creating participant:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    participantId = participantResponse.data.createParticipant.id;

    const createCategoryMutation = gql`
      mutation CreateCategory($name: String!) {
        createCategory(name: $name) {
          id
          version
        }
      }
    `;
    const categoryResponse = await client.mutate({
      mutation: createCategoryMutation,
      variables: {
        name: `Test Category ${randomInt}`,
      },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error creating category:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    categoryId = categoryResponse.data.createCategory.id;
  });

  test('Edit Event with correct version', async () => {
    const getEventQuery = gql`
      query GetEvent($id: Int!) {
        event(id: $id) {
          id
          version
        }
      }
    `;
    const eventResponse = await client.query({
      query: getEventQuery,
      variables: { id: eventId },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error fetching event:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const event = eventResponse.data.event;

    const editEventMutation = gql`
      mutation EditEvent($id: Int!, $version: Int!, $title: String) {
        editEvent(id: $id, version: $version, title: $title) {
          id
          version
        }
      }
    `;
    const updatedEventResponse = await client.mutate({
      mutation: editEventMutation,
      variables: {
        id: eventId,
        version: event.version,
        title: 'Updated Test Event',
      },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error editing event:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const updatedEvent = updatedEventResponse.data.editEvent;

    expect(updatedEvent.version).toBe(event.version + 1);
  });

  test('Edit Event with incorrect version', async () => {
    const getEventQuery = gql`
      query GetEvent($id: Int!) {
        event(id: $id) {
          id
          version
        }
      }
    `;
    const eventResponse = await client.query({
      query: getEventQuery,
      variables: { id: eventId },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error fetching event:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const event = eventResponse.data.event;

    const editEventMutation = gql`
      mutation EditEvent($id: Int!, $version: Int!, $title: String) {
        editEvent(id: $id, version: $version, title: $title) {
          id
          version
        }
      }
    `;
    await expect(
      client.mutate({
        mutation: editEventMutation,
        variables: {
          id: eventId,
          version: event.version - 1,
          title: 'Another Update',
        },
        context: {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      }).catch(error => {
        // console.error('Error editing event with incorrect version:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
        throw error;
      })
    ).rejects.toThrow();
  });

  test('Edit Participant with correct version', async () => {
    const getParticipantQuery = gql`
      query GetParticipant($id: Int!) {
        eventParticipants(eventId: $id) {
          id
          version
        }
      }
    `;
    const participantResponse = await client.query({
      query: getParticipantQuery,
      variables: { id: eventId },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error fetching participant:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const participant = participantResponse.data.eventParticipants[0];

    const editParticipantMutation = gql`
      mutation EditParticipant($id: Int!, $version: Int!, $approved: Boolean) {
        editParticipant(id: $id, version: $version, approved: $approved) {
          id
          version
        }
      }
    `;
    const updatedParticipantResponse = await client.mutate({
      mutation: editParticipantMutation,
      variables: {
        id: participantId,
        version: participant.version,
        approved: true,
      },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error editing participant:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const updatedParticipant = updatedParticipantResponse.data.editParticipant;

    expect(updatedParticipant.version).toBe(participant.version + 1);
  });

  test('Edit Participant with incorrect version', async () => {
    const getParticipantQuery = gql`
      query GetParticipant($id: Int!) {
        eventParticipants(eventId: $id) {
          id
          version
        }
      }
    `;
    const participantResponse = await client.query({
      query: getParticipantQuery,
      variables: { id: participantId },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error fetching participant:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const participant = participantResponse.data.eventParticipants;

    const editParticipantMutation = gql`
      mutation EditParticipant($id: Int!, $version: Int!, $approved: Boolean) {
        editParticipant(id: $id, version: $version, approved: $approved) {
          id
          version
        }
      }
    `;
    await expect(
      client.mutate({
        mutation: editParticipantMutation,
        variables: {
          id: participantId,
          version: participant.version - 1,
          approved: false,
        },
        context: {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      }).catch(error => {
        // console.error('Error editing participant with incorrect version:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
        throw error;
      })
    ).rejects.toThrow();
  });

  test('Edit Category with correct version', async () => {
    const getCategoryQuery = gql`
      query GetCategory($id: Int!) {
        category(id: $id) {
          id
          version
        }
      }
    `;
    const categoryResponse = await client.query({
      query: getCategoryQuery,
      variables: { id: categoryId },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error fetching category:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const category = categoryResponse.data.category;

    const editCategoryMutation = gql`
      mutation EditCategory($id: Int!, $version: Int!, $name: String!) {
        editCategory(id: $id, version: $version, name: $name) {
          id
          version
        }
      }
    `;
    const randomInt = getRandomInt(100);
    const updatedCategoryResponse = await client.mutate({
      mutation: editCategoryMutation,
      variables: {
        id: categoryId,
        version: category.version,
        name: 'Updated Test Category' + randomInt,
      },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error editing category:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const updatedCategory = updatedCategoryResponse.data.editCategory;

    expect(updatedCategory.version).toBe(category.version + 1);
  });

  test('Edit Category with incorrect version', async () => {
    const getCategoryQuery = gql`
      query GetCategory($id: Int!) {
        category(id: $id) {
          id
          version
        }
      }
    `;
    const categoryResponse = await client.query({
      query: getCategoryQuery,
      variables: { id: categoryId },
      context: {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
    }).catch(error => {
      // console.error('Error fetching category:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
      throw error;
    });
    const category = categoryResponse.data.category;

    const editCategoryMutation = gql`
      mutation EditCategory($id: Int!, $version: Int!, $name: String!) {
        editCategory(id: $id, version: $version, name: $name) {
          id
          version
        }
      }
    `;
    await expect(
      client.mutate({
        mutation: editCategoryMutation,
        variables: {
          id: categoryId,
          version: category.version - 1,
          name: 'Another Update',
        },
        context: {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      }).catch(error => {
        // console.error('Error editing category with incorrect version:', JSON.stringify(error.networkError || error.graphQLErrors || error.message));
        throw error;
      })
    ).rejects.toThrow();
  });
});