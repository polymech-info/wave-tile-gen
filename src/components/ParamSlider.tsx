type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
};

export function ParamSlider({ label, value, min, max, step = 0.01, unit, onChange }: Props) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-foreground">
          {Number.isInteger(step) ? value.toFixed(0) : value.toFixed(2)}
          {unit ? <span className="ml-0.5 text-muted-foreground">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-input accent-primary"
      />
    </label>
  );
}
