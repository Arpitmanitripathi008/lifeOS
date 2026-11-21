import { useState, useEffect } from 'react';
import { Sun, Sunrise, Moon } from 'lucide-react';
import { api } from '../../services/api';

function getGreeting(): { text: string; icon: any } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', icon: Sunrise };
  if (hour < 17) return { text: 'Good afternoon', icon: Sun };
  return { text: 'Good evening', icon: Moon };
}

function formatDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

export function GreetingHeader() {
  const [name, setName] = useState('Student');
  const greeting = getGreeting();
  const Icon = greeting.icon;

  useEffect(() => {
    api.getProfile()
      .then((p) => {
        if (p?.displayName) setName(p.displayName);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={20} strokeWidth={1.5} className="text-terracotta" />
        <h1 className="text-xl font-semibold text-charcoal">
          {greeting.text}, {name}
        </h1>
      </div>
      <p className="text-sm text-muted">{formatDate()}</p>
    </div>
  );
}
