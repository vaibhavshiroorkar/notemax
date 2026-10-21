import type { CSSProperties, ReactNode } from "react";

/** A row of buttons where exactly one is chosen, like Light, Dark, System. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; style?: CSSProperties }[];
  onChange(value: T): void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} role="radio" aria-checked={value === option.value} style={option.style} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
