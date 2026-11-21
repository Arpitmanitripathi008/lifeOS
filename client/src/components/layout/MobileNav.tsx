import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  Target,
  Timer,
} from 'lucide-react';

const mobileNavItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/planner', label: 'Planner', icon: CalendarDays },
  { path: '/academics', label: 'Academics', icon: GraduationCap },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/focus', label: 'Focus', icon: Timer },
];

interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className = '' }: MobileNavProps) {
  const location = useLocation();

  return (
    <nav
      className={`bg-paper border-t border-border-light px-2 py-1.5 ${className}`}
    >
      <div className="flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center gap-0.5 py-1 px-3"
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2 : 1.5}
                className={isActive ? 'text-olive' : 'text-muted-light'}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-olive' : 'text-muted-light'
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
