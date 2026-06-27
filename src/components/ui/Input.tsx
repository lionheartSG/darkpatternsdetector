import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  helperText?: string;
  error?: string;
};

export function Input({
  label,
  helperText,
  error,
  id,
  className = "",
  ...props
}: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={
          error
            ? `${inputId}-error`
            : helperText
              ? `${inputId}-helper`
              : undefined
        }
        className={`min-h-11 w-full rounded-lg border bg-background px-4 py-2 text-base text-foreground transition-colors duration-200 placeholder:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
          error ? "border-destructive" : "border-border"
        } ${className}`}
        {...props}
      />
      {helperText && !error ? (
        <p id={`${inputId}-helper`} className="text-sm text-secondary">
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
