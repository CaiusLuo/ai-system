import { z, type ZodTypeAny } from 'zod';

export const apiResponseEnvelopeSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown(),
});

export const createApiResponseSchema = <T extends ZodTypeAny>(dataSchema: T) =>
  apiResponseEnvelopeSchema.extend({
    data: dataSchema,
  });
