interface StatusBadgeProps {
  status: 'pending' | 'completed' | 'partial' | 'postponed' | 'cancelled' | 'urgent' | 'info';
  label: string;
}

const statusStyles: Record<StatusBadgeProps['status'], string> = {
  pending: 'bg-beige text-muted',
  completed: 'bg-sage/60 text-olive-dark',
  partial: 'bg-beige text-terracotta',
  postponed: 'bg-terracotta/10 text-terracotta',
  cancelled: 'bg-beige-light text-muted-light line-through',
  urgent: 'bg-terracotta/15 text-terracotta-dark',
  info: 'bg-sage/30 text-olive',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[status]}`}
    >
      {label}
    </span>
  );
}
