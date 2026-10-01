const ATTENDANCE_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const CHECK_IN_OPEN_MINUTES = 7 * 60 + 30;
const PUNCH_CLOSE_MINUTES = 18 * 60;

const vietnamTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ATTENDANCE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ATTENDANCE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const partsToObject = (formatter, date) => Object.fromEntries(
  formatter.formatToParts(date)
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, part.value])
);

export const getAttendanceWindowState = (date = new Date()) => {
  const { hour, minute } = partsToObject(vietnamTimeFormatter, date);
  const currentMinutes = Number(hour) * 60 + Number(minute);

  if (currentMinutes < CHECK_IN_OPEN_MINUTES) {
    return { allowed: false, message: 'Check-in mở từ 07:30.' };
  }
  if (currentMinutes > PUNCH_CLOSE_MINUTES) {
    return { allowed: false, message: 'Check-out đã đóng lúc 18:00.' };
  }
  return { allowed: true, message: 'Khung giờ chấm công: 07:30–18:00.' };
};

export const getAttendancePunchState = (history = [], date = new Date()) => {
  const windowState = getAttendanceWindowState(date);
  const { year, month, day } = partsToObject(vietnamDateFormatter, date);
  const today = `${year}-${month}-${day}`;
  const hasCheckedIn = history.some(record => {
    const recordDate = Array.isArray(record.date)
      ? `${record.date[0]}-${String(record.date[1]).padStart(2, '0')}-${String(record.date[2]).padStart(2, '0')}`
      : record.date;
    return recordDate === today && record.timeIn && record.timeIn !== '00:00:00';
  });

  return {
    ...windowState,
    action: hasCheckedIn ? 'CHECK_OUT' : 'CHECK_IN',
    label: hasCheckedIn ? 'Check-out ngay' : 'Check-in ngay'
  };
};
