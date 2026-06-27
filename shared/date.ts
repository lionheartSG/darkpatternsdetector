const SGT_TIMEZONE = "Asia/Singapore";

export function formatDateSGT(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SGT_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return formatter.format(date);
}

export function formatDateTimeSGT(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SGT_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${formatter.format(date)} SGT`;
}
