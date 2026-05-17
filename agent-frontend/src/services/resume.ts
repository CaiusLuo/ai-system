import { z } from 'zod';
import { api, type ApiResponse } from './api';

export interface Resume {
  id: number;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

const resumeSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  size: z.number(),
  uploadedAt: z.string(),
});

const resumeListSchema = z.array(resumeSchema);

export async function getResumeList(): Promise<ApiResponse<Resume[]>> {
  return api.get('/api/resumes', resumeListSchema);
}

export async function deleteResume(id: number): Promise<ApiResponse<null>> {
  return api.delete(`/api/resumes/${id}`, z.null());
}

export async function activateResume(id: number): Promise<ApiResponse<null>> {
  return api.post(`/api/resumes/${id}/activate`, undefined, z.null());
}
