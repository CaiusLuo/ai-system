import {
  documentBizTypeSchema,
  storageUploadResponseSchema,
  type DocumentBizType,
  type StorageUploadResponse,
} from '../schemas';
import { api, type ApiResponse } from './api';

export type { DocumentBizType, StorageUploadResponse };

export async function uploadAvatar(
  file: File
): Promise<ApiResponse<StorageUploadResponse>> {
  const formData = new FormData();
  formData.append('file', file);
  return api.postForm('/api/storage/avatar/upload', formData, storageUploadResponseSchema);
}

export async function uploadDocument(
  file: File,
  bizType: DocumentBizType
): Promise<ApiResponse<StorageUploadResponse>> {
  const validatedBizType = documentBizTypeSchema.parse(bizType);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bizType', validatedBizType);
  return api.postForm('/api/storage/document/upload', formData, storageUploadResponseSchema);
}
