export const INPUT_TYPE_COLORS = {
  text_input: { 
    bg: 'bg-green-100', 
    border: 'border-green-500', 
    text: 'text-green-800' 
  },
  checkbox: { 
    bg: 'bg-orange-100', 
    border: 'border-orange-500', 
    text: 'text-orange-800' 
  }
} as const;

export const FIELD_TYPE_COLORS = {
  label: {
    bg: 'bg-blue-100',
    border: 'border-blue-500',
    text: 'text-blue-800',
    hover: 'hover:bg-blue-200'
  },
  text_input: {
    bg: 'bg-green-100',
    border: 'border-green-500',
    text: 'text-green-800',
    hover: 'hover:bg-green-200'
  },
  checkbox: {
    bg: 'bg-orange-100',
    border: 'border-orange-500',
    text: 'text-orange-800',
    hover: 'hover:bg-orange-200'
  }
} as const;

export const INPUT_TYPE_LABELS = {
  text_input: 'Text Input',
  checkbox: 'Checkbox'
} as const; 