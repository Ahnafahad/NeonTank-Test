'use client';

import { useId } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function Select({
  label,
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select an option',
}: SelectProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={`
          text-sm font-medium
          ${disabled ? 'text-gray-500' : 'text-gray-200'}
        `}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`
            w-full
            px-4 py-3
            bg-gray-900/80
            border-2 border-[#00ffff]
            rounded-lg
            text-gray-200
            font-medium
            appearance-none
            cursor-pointer
            transition-all duration-200 ease-out
            shadow-[0_0_10px_rgba(0,255,255,0.2),inset_0_0_10px_rgba(0,255,255,0.05)]

            hover:shadow-[0_0_15px_rgba(0,255,255,0.4),inset_0_0_15px_rgba(0,255,255,0.1)]
            hover:border-[#00ffff]

            focus:outline-none
            focus:shadow-[0_0_20px_rgba(0,255,255,0.5),inset_0_0_20px_rgba(0,255,255,0.15)]
            focus:border-[#00ffff]

            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-gray-900 text-gray-200"
            >
              {option.label}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-5 h-5 ${disabled ? 'text-gray-500' : 'text-[#00ffff]'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Named export for backwards compatibility
export { Select };
