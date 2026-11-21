import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  Target,
  Timer,
  ClipboardCheck,
  BarChart3,
  Settings,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/planner', label: 'My Planner', icon: CalendarDays },
  { path: '/academics', label: 'Academics', icon: GraduationCap },
  { path: '/goals', label: 'Personal Goals', icon: Target },
  { path: '/focus', label: 'Focus', icon: Timer },
  { path: '/review', label: 'Daily Review', icon: ClipboardCheck },
  { path: '/insights', label: 'Insights', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className = '', onClose }: SidebarProps) {
  const location = useLocation();
  const { user, profile, logout } = useAuth();

  const displayName = profile?.displayName || user?.fullName || 'Student';
  const username = user?.username || 'user';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className={`flex flex-col w-64 bg-paper border-r border-border-light h-screen ${className}`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-border-light">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-olive flex items-center justify-center shadow-sm">
            <span className="text-paper text-sm font-serif font-bold">L</span>
          </div>
          <div>
            <h1 className="font-serif font-semibold text-charcoal text-base leading-tight">LifeOS</h1>
            <p className="text-[10px] text-muted tracking-wide uppercase font-sans">Student Edition</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-beige-light transition-colors lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} className="text-muted" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                ${
                  isActive
                    ? 'bg-sage/50 text-olive-dark'
                    : 'text-muted hover:bg-beige-light hover:text-charcoal'
                }
              `}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2 : 1.5}
                className={isActive ? 'text-olive' : 'text-muted-light'}
              />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-olive" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User profile & Sign Out */}
      <div className="px-4 py-3 border-t border-border-light bg-ivory/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-sage flex items-center justify-center text-olive-dark font-serif font-semibold text-xs shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-charcoal truncate">{displayName}</p>
              <p className="text-[10px] text-muted truncate">@{username}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            title="Sign out of LifeOS"
            className="p-1.5 rounded-lg text-muted hover:text-terracotta hover:bg-terracotta/10 transition-colors shrink-0"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
