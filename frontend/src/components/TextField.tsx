import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function TextField({ label, ...input }: TextFieldProps) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <input {...input} className="field" />
    </label>
  );
}
