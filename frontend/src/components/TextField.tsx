import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function TextField({ label, ...input }: TextFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input
        {...input}
        className="block w-full rounded border border-gray-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-600"
      />
    </label>
  );
}
