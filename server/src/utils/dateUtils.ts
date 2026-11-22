import { Request } from 'express';

export interface ClientDateInfo {
  today: string;
  currentTime: string;
  dayOfWeek: number;
  dayOfWeekName: string;
  tomorrowStr: string;
}

/**
 * Resolves the user's actual local date and time from request headers or body.
 * Prevents UTC cloud servers (such as Render) from miscalculating the client's current date/time
 * (e.g. at 1:00 AM on Nov 23 in India, a UTC server is at 7:30 PM on Nov 22).
 */
export function getClientDateInfo(req: Request): ClientDateInfo {
  const bodyDate = req.body?.clientDate || req.body?.date;
  const headerDate = req.headers['x-client-date'] as string;
  const bodyTime = req.body?.clientTime;
  const headerTime = req.headers['x-client-time'] as string;

  let today: string;
  if (bodyDate && typeof bodyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bodyDate)) {
    today = bodyDate;
  } else if (headerDate && /^\d{4}-\d{2}-\d{2}$/.test(headerDate)) {
    today = headerDate;
  } else {
    // If timezone offset in minutes was sent by browser (new Date().getTimezoneOffset())
    const tzOffset = req.headers['x-timezone-offset'];
    if (tzOffset !== undefined) {
      const offsetMins = parseInt(tzOffset as string, 10);
      if (!isNaN(offsetMins)) {
        // UTC = local + offset, so local = UTC - offset
        const localMs = Date.now() - offsetMins * 60 * 1000;
        const localDate = new Date(localMs);
        today = localDate.toISOString().split('T')[0];
      } else {
        today = new Date().toISOString().split('T')[0];
      }
    } else {
      today = new Date().toISOString().split('T')[0];
    }
  }

  let currentTime: string;
  if (bodyTime && typeof bodyTime === 'string' && /^\d{1,2}:\d{2}$/.test(bodyTime)) {
    currentTime = bodyTime;
  } else if (headerTime && /^\d{1,2}:\d{2}$/.test(headerTime)) {
    currentTime = headerTime;
  } else {
    currentTime = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const [year, month, day] = today.split('-').map(Number);
  const localDateObj = new Date(year, month - 1, day);
  const dayOfWeek = localDateObj.getDay();
  const dayOfWeekName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];

  const tomorrowObj = new Date(year, month - 1, day + 1);
  const tomorrowStr = `${tomorrowObj.getFullYear()}-${String(tomorrowObj.getMonth() + 1).padStart(2, '0')}-${String(tomorrowObj.getDate()).padStart(2, '0')}`;

  return {
    today,
    currentTime,
    dayOfWeek,
    dayOfWeekName,
    tomorrowStr,
  };
}
