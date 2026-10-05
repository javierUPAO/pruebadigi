'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';
import { fieldBase, FieldWrapper, describedBy } from './Field';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, containerClassName, className, id, required, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <FieldWrapper
        id={fieldId}
        label={label}
        hint={hint}
        error={error}
        required={required}
        className={containerClassName}
      >
        <input
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, hint, error)}
          className={cn(fieldBase, error ? 'border-red-300' : 'border-slate-200', className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);

Input.displayName = 'Input';
