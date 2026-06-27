import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-primary disabled:bg-primary/50",
  secondary:
    "border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring disabled:opacity-50",
  ghost:
    "text-foreground hover:bg-muted focus-visible:ring-ring disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed motion-reduce:transition-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
