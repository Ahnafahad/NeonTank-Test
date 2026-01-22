'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-transparent
    border-2 border-[#ff0055]
    text-[#ff0055]
    shadow-[0_0_10px_rgba(255,0,85,0.3),inset_0_0_10px_rgba(255,0,85,0.1)]
    hover:bg-[#ff0055]/20
    hover:shadow-[0_0_20px_rgba(255,0,85,0.5),0_0_40px_rgba(255,0,85,0.3),inset_0_0_20px_rgba(255,0,85,0.2)]
    hover:text-white
    active:bg-[#ff0055]/30
  `,
  secondary: `
    bg-transparent
    border-2 border-[#00ffff]
    text-[#00ffff]
    shadow-[0_0_10px_rgba(0,255,255,0.3),inset_0_0_10px_rgba(0,255,255,0.1)]
    hover:bg-[#00ffff]/20
    hover:shadow-[0_0_20px_rgba(0,255,255,0.5),0_0_40px_rgba(0,255,255,0.3),inset_0_0_20px_rgba(0,255,255,0.2)]
    hover:text-white
    active:bg-[#00ffff]/30
  `,
  danger: `
    bg-transparent
    border-2 border-red-500
    text-red-500
    shadow-[0_0_10px_rgba(239,68,68,0.3),inset_0_0_10px_rgba(239,68,68,0.1)]
    hover:bg-red-500/20
    hover:shadow-[0_0_20px_rgba(239,68,68,0.5),0_0_40px_rgba(239,68,68,0.3),inset_0_0_20px_rgba(239,68,68,0.2)]
    hover:text-white
    active:bg-red-500/30
  `,
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading = false, disabled, children, className = '', ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          relative
          px-6 py-3
          font-bold uppercase tracking-wider
          rounded-lg
          transition-all duration-200 ease-out
          cursor-pointer
          ${variantStyles[variant]}
          ${isDisabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:shadow-none' : ''}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
