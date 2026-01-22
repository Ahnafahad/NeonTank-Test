'use client';

import { useId } from 'react';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
}

export default function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled = false,
  showValue = true,
  valueFormatter = (v) => v.toString(),
}: SliderProps) {
  const id = useId();

  // Calculate percentage for gradient
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className={`
            text-sm font-medium
            ${disabled ? 'text-gray-500' : 'text-gray-200'}
          `}
        >
          {label}
        </label>
        {showValue && (
          <span
            className={`
              text-sm font-mono
              ${disabled ? 'text-gray-500' : 'text-[#00ffff]'}
            `}
          >
            {valueFormatter(value)}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className={`
          w-full h-2
          rounded-full
          appearance-none
          cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}

          [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:h-2

          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[#00ffff]
          [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,255,255,0.8)]
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-[#00ffff]
          [&::-webkit-slider-thumb]:mt-[-6px]
          [&::-webkit-slider-thumb]:transition-all
          [&::-webkit-slider-thumb]:duration-200
          [&::-webkit-slider-thumb]:hover:shadow-[0_0_20px_rgba(0,255,255,1)]
          [&::-webkit-slider-thumb]:hover:scale-110

          [&::-moz-range-track]:rounded-full
          [&::-moz-range-track]:h-2
          [&::-moz-range-track]:bg-gray-700

          [&::-moz-range-thumb]:appearance-none
          [&::-moz-range-thumb]:w-5
          [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[#00ffff]
          [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(0,255,255,0.8)]
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-[#00ffff]
          [&::-moz-range-thumb]:transition-all
          [&::-moz-range-thumb]:duration-200
          [&::-moz-range-thumb]:hover:shadow-[0_0_20px_rgba(0,255,255,1)]
        `}
        style={{
          background: `linear-gradient(to right, #00ffff ${percentage}%, #374151 ${percentage}%)`,
        }}
      />
    </div>
  );
}

// Named export for backwards compatibility
export { Slider };
