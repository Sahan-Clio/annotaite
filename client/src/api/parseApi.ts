import { useMutation } from '@tanstack/react-query';
import { api } from './apiClient';
import type { ParseResponse, ApiError } from '../types/api';

export const parseDocument = async (file: File): Promise<ParseResponse> => {
  try {
    // For now, we don't actually send the file since the backend is hardcoded
    // But we'll structure it for future when we do use the file
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ParseResponse>('/parse');
    return response.data;
  } catch (error) {
    // Return dummy data instead of throwing error
    console.log('API failed, returning dummy data for testing:', error);
    return dummyParseResponse;
  }
};

// Dummy data for testing when API fails
// Using normalized coordinates (0-1) for proper overlay positioning
const dummyParseResponse: ParseResponse = {
  fields: [
    {
      name: "First Name",
      label_bounding_box: {
        page: 1,
        x_min: 0.1,
        y_min: 0.8,
        x_max: 0.3,
        y_max: 0.85
      },
      input_bounding_box: {
        page: 1,
        x_min: 0.35,
        y_min: 0.8,
        x_max: 0.6,
        y_max: 0.85
      }
    },
    {
      name: "Last Name",
      label_bounding_box: {
        page: 1,
        x_min: 0.1,
        y_min: 0.7,
        x_max: 0.3,
        y_max: 0.75
      },
      input_bounding_box: {
        page: 1,
        x_min: 0.35,
        y_min: 0.7,
        x_max: 0.6,
        y_max: 0.75
      }
    },
    {
      name: "Email Address",
      label_bounding_box: {
        page: 1,
        x_min: 0.1,
        y_min: 0.6,
        x_max: 0.3,
        y_max: 0.65
      },
      input_bounding_box: {
        page: 1,
        x_min: 0.35,
        y_min: 0.6,
        x_max: 0.7,
        y_max: 0.65
      }
    }
  ],
  metadata: [
    {
      content: "Form I-907 - Request for Premium Processing Service",
      bounding_box: {
        page: 1,
        x_min: 0.1,
        y_min: 0.9,
        x_max: 0.8,
        y_max: 0.95
      }
    },
    {
      content: "Instructions: Please fill out all required fields",
      bounding_box: {
        page: 1,
        x_min: 0.1,
        y_min: 0.5,
        x_max: 0.7,
        y_max: 0.55
      }
    },
    {
      content: "Page 1 of 3",
      bounding_box: {
        page: 1,
        x_min: 0.8,
        y_min: 0.05,
        x_max: 0.95,
        y_max: 0.1
      }
    }
  ]
};

export const useParseDocument = () => {
  return useMutation<ParseResponse, ApiError, File>({
    mutationFn: async (file: File) => {
      try {
        return await parseDocument(file);
      } catch (error) {
        // Return dummy data instead of throwing error
        console.log('API failed, returning dummy data for testing:', error);
        return dummyParseResponse;
      }
    },
  });
}; 