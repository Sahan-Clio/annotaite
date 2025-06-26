import { useMutation } from '@tanstack/react-query';
import { api } from './apiClient';
import type { ParseResponse, ApiError } from '../types/api';

export const parseDocument = async (file: File): Promise<ParseResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    throw new Error('Failed to parse document');
  }
};

export const useParseDocument = () => {
  return useMutation({
    mutationFn: parseDocument,
    onError: (error) => {
      console.error('Parse document error:', error);
    }
  });
}; 