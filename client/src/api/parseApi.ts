import { useMutation } from '@tanstack/react-query';
import { api } from './apiClient';
import type { ParseResponse, ApiError } from '../types/api';

export const parseDocument = async (file: File): Promise<ParseResponse> => {
  // For now, we don't actually send the file since the backend is hardcoded
  // But we'll structure it for future when we do use the file
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<ParseResponse>('/parse');
  return response.data;
};

export const useParseDocument = () => {
  return useMutation<ParseResponse, ApiError, File>({
    mutationFn: parseDocument,
  });
}; 