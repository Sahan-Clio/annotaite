import { useMutation } from '@tanstack/react-query';
import { api } from './apiClient';
import type { ParseResponse, ApiError } from '../types/api';

export const parseDocument = async (): Promise<ParseResponse> => {
  try {
    const response = await api.post('/parse');
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Failed to parse document');
  }
};

export const useParseDocument = () => {
  return useMutation<ParseResponse, ApiError, void>({
    mutationFn: parseDocument,
  });
}; 