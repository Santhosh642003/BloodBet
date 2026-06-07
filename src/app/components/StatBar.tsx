interface StatBarProps {
  label: string;
  value: number;
  max?: number;
}

export function StatBar({ label, value, max = 10 }: StatBarProps) {
  const percentage = (value / max) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-accent-gold text-xs uppercase min-w-[40px]">{label}</span>
      <div className="flex-1 h-2 bg-bg-tertiary relative">
        <div
          className="h-full bg-gradient-to-r from-accent-gold to-accent-crimson-end transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="font-mono text-text-secondary text-xs min-w-[40px]">
        {value}/{max}
      </span>
    </div>
  );
}
