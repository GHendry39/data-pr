import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  MeetingPlace: a
    .model({
      location: a.string().required(),
      rating: a.integer(),
    })
    .authorization(allow => [allow.guest()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'iam',
  },
});
