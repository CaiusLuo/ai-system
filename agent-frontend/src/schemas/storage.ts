import { z } from 'zod';

export const storageUploadResponseSchema = z.object({
  bucket: z.string(),
  objectKey: z.string(),
  url: z.string(),
  etag: z.string().nullable().optional(),
  size: z.number(),
  contentType: z.string().nullable().optional(),
  originalFileName: z.string(),
});

export const documentBizTypeSchema = z.enum([
  'resume',
  'chat-file',
  'kb-source',
  'document',
]);
