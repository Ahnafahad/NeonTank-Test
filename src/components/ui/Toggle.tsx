'use client';

import { useId } from 'react';

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ label, value, onChange, disabled = false }: ToggleProps) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-4">
      <label
        htmlFor={id}
        className={`
          text-sm font-medium
          ${disabled ? 'text-gray-500' : 'text-gray-200'}
          cursor-pointer
        `}
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => !disabled && onChange(!value)}
        className={`
          relative
          w-14 h-7
          rounded-full
          border-2
          transition-all duration-300 ease-out
          ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          ${
            value
              ? 'bg-[#00ffff]/20 border-[#00ffff] shadow-[0_0_15px_rgba(0,255,255,0.5),inset_0_0_10px_rgba(0,255,255,0.2)]'
              : 'bg-gray-800 border-gray-600 shadow-none'
          }
        `}
      >
        <span
          className={`
            absolute
            top-0.5
            w-5 h-5
            rounded-full
            transition-all duration-300 ease-out
            ${
              value
                ? 'left-7 bg-[#00ffff] shadow-[0_0_10px_rgba(0,255,255,0.8)]'
                : 'left-0.5 bg-gray-400'
            }
          `}
        />
      </button>
    </div>
  );
}

// Named export for backwards compatibility
export { Toggle };
