interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  color?: 'olive' | 'terracotta' | 'sage';
  showLabel?: boolean;
}

const colorMap = {
  olive: 'bg-olive',
  terracotta: 'bg-terracotta',
  sage: 'bg-sage',
};

export function ProgressBar({
  value,
  max = 100,
  size = 'sm',
  color = 'olive',
  showLabel = false,
}: ProgressBarProps) {
  const percentage = Math.min(Math.round((value / max) * 100), 100);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex-1 bg-beige-light rounded-full overflow-hidden ${
          size === 'sm' ? 'h-1.5' : 'h-2.5'
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-muted font-medium min-w-[2.5rem] text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
}
