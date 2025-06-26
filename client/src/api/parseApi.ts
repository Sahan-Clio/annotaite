import { useMutation } from '@tanstack/react-query';
import { api } from './apiClient';
import type { ParseResponse, ApiError } from '../types/api';
import hardcodedData from '../data/hardcoded-parse-data.json';

export const parseDocument = async (file: File): Promise<ParseResponse> => {
  // Always return hardcoded data instead of making API calls
  console.log('Using hardcoded parse data for file:', file.name);
  
  // Simulate a small delay to mimic API call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return hardcodedData as ParseResponse;
};



export const useParseDocument = () => {
  return useMutation<ParseResponse, ApiError, File>({
    mutationFn: parseDocument,
  });
}; 