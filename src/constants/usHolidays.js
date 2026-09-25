// backend/src/constants/usHolidays.js

export const US_FEDERAL_HOLIDAYS = [
  { id: 'hol-new-year', name: "New Year's Day", month: 1, day: 1, type: 'FIXED' },
  { id: 'hol-mlk', name: 'Martin Luther King Jr. Day', month: 1, nth: 3, dayOfWeek: 1, type: 'FLOATING' }, // 3rd Mon in Jan
  { id: 'hol-presidents', name: "Presidents' Day (Washington's Birthday)", month: 2, nth: 3, dayOfWeek: 1, type: 'FLOATING' }, // 3rd Mon in Feb
  { id: 'hol-memorial', name: 'Memorial Day', month: 5, last: true, dayOfWeek: 1, type: 'FLOATING' }, // Last Mon in May
  { id: 'hol-juneteenth', name: 'Juneteenth National Independence Day', month: 6, day: 19, type: 'FIXED' },
  { id: 'hol-independence', name: 'Independence Day', month: 7, day: 4, type: 'FIXED' },
  { id: 'hol-labor', name: 'Labor Day', month: 9, nth: 1, dayOfWeek: 1, type: 'FLOATING' }, // 1st Mon in Sept
  { id: 'hol-columbus', name: "Columbus Day / Indigenous Peoples' Day", month: 10, nth: 2, dayOfWeek: 1, type: 'FLOATING' }, // 2nd Mon in Oct
  { id: 'hol-veterans', name: 'Veterans Day', month: 11, day: 11, type: 'FIXED' },
  { id: 'hol-thanksgiving', name: 'Thanksgiving Day', month: 11, nth: 4, dayOfWeek: 4, type: 'FLOATING' }, // 4th Thurs in Nov
  { id: 'hol-christmas', name: 'Christmas Day', month: 12, day: 25, type: 'FIXED' },
];

const formatDateStr = (dateObj) => {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getUSHolidaysForYear = (year) => {
  const results = [];

  US_FEDERAL_HOLIDAYS.forEach(hol => {
    let actualDate;

    if (hol.type === 'FIXED') {
      actualDate = new Date(year, hol.month - 1, hol.day);
    } else if (hol.last) {
      const lastDayOfMonth = new Date(year, hol.month, 0);
      let day = lastDayOfMonth.getDate();
      while (new Date(year, hol.month - 1, day).getDay() !== hol.dayOfWeek) {
        day--;
      }
      actualDate = new Date(year, hol.month - 1, day);
    } else if (hol.nth) {
      let count = 0;
      let day = 1;
      while (count < hol.nth && day <= 31) {
        const d = new Date(year, hol.month - 1, day);
        if (d.getMonth() !== hol.month - 1) break;
        if (d.getDay() === hol.dayOfWeek) {
          count++;
          if (count === hol.nth) {
            actualDate = d;
            break;
          }
        }
        day++;
      }
    }

    if (actualDate) {
      let observedDate = new Date(actualDate);
      if (hol.type === 'FIXED') {
        const dow = actualDate.getDay();
        if (dow === 6) {
          observedDate.setDate(actualDate.getDate() - 1);
        } else if (dow === 0) {
          observedDate.setDate(actualDate.getDate() + 1);
        }
      }

      const dateStr = formatDateStr(actualDate);
      const observedStr = formatDateStr(observedDate);

      results.push({
        id: hol.id,
        name: hol.name,
        date: dateStr,
        observedDate: observedStr,
        isObservedDiff: dateStr !== observedStr
      });
    }
  });

  return results.sort((a, b) => a.observedDate.localeCompare(b.observedDate));
};

export const isUSFederalHoliday = (dateStr) => {
  if (!dateStr) return { isHoliday: false };

  const [yearStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const holidays = getUSHolidaysForYear(year);

  const matched = holidays.find(h => h.date === dateStr || h.observedDate === dateStr);
  if (matched) {
    return {
      isHoliday: true,
      name: matched.name,
      observedDate: matched.observedDate,
      isObserved: matched.isObservedDiff
    };
  }

  return { isHoliday: false };
};

export const getTodayDateStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isPastDate = (dateStr) => {
  if (!dateStr) return false;
  return dateStr < getTodayDateStr();
};

export const isWeekend = (dateStr) => {
  if (!dateStr) return { isWeekend: false, dayName: '' };
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  if (day === 0) return { isWeekend: true, dayName: 'Sunday' };
  if (day === 6) return { isWeekend: true, dayName: 'Saturday' };
  return { isWeekend: false, dayName: '' };
};

export const isClinicClosed = (dateStr) => {
  if (!dateStr) return { isClosed: false, reason: '' };

  if (isPastDate(dateStr)) {
    return {
      isClosed: true,
      isPast: true,
      isWeekend: false,
      isHoliday: false,
      reason: 'Past Date - Appointments cannot be scheduled for past dates'
    };
  }

  const weekendCheck = isWeekend(dateStr);
  if (weekendCheck.isWeekend) {
    return {
      isClosed: true,
      isPast: false,
      isWeekend: true,
      isHoliday: false,
      reason: `Weekend (${weekendCheck.dayName}) - Clinic is closed`
    };
  }

  const holidayCheck = isUSFederalHoliday(dateStr);
  if (holidayCheck.isHoliday) {
    return {
      isClosed: true,
      isPast: false,
      isWeekend: false,
      isHoliday: true,
      reason: `US Federal Holiday (${holidayCheck.name}) - Clinic is closed`,
      holidayName: holidayCheck.name
    };
  }

  return { isClosed: false, isPast: false, isWeekend: false, isHoliday: false, reason: '' };
};
