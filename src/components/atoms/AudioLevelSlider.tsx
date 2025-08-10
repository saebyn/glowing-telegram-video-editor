import React, { useId } from 'react';

interface AudioLevelSliderProps {
  /**
   * Current audio level from 0.0 to 1.0
   */
  level: number;
  /**
   * Callback when level changes
   */
  onChange: (level: number) => void;
  /**
   * Label for the slider
   */
  label?: string;
  /**
   * Whether the slider is disabled
   */
  disabled?: boolean;
}

export default function AudioLevelSlider({
  level,
  onChange,
  label,
  disabled = false,
}: AudioLevelSliderProps) {
  const sliderId = useId();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLevel = Number.parseFloat(event.target.value);
    onChange(newLevel);
  };

  return (
    <div className="flex flex-col space-y-1">
      {label && (
        <label
          htmlFor={sliderId}
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">0</span>
        <input
          id={sliderId}
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={level}
          onChange={handleChange}
          disabled={disabled}
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">1</span>
      </div>
      <div className="text-xs text-center text-gray-600 dark:text-gray-400">
        {Math.round(level * 100)}%
      </div>
    </div>
  );
}
