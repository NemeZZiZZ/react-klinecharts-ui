export interface TimezoneOption {
  key: string;
  localeKey: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { key: "Etc/UTC", localeKey: "utc" },
  { key: "Pacific/Honolulu", localeKey: "honolulu" },
  { key: "America/Juneau", localeKey: "juneau" },
  { key: "America/Los_Angeles", localeKey: "los_angeles" },
  { key: "America/Chicago", localeKey: "chicago" },
  { key: "America/Toronto", localeKey: "toronto" },
  { key: "America/Sao_Paulo", localeKey: "sao_paulo" },
  { key: "Europe/London", localeKey: "london" },
  { key: "Europe/Berlin", localeKey: "berlin" },
  { key: "Asia/Bahrain", localeKey: "bahrain" },
  { key: "Asia/Dubai", localeKey: "dubai" },
  { key: "Asia/Ashkhabad", localeKey: "ashkhabad" },
  { key: "Asia/Almaty", localeKey: "almaty" },
  { key: "Asia/Bangkok", localeKey: "bangkok" },
  { key: "Asia/Shanghai", localeKey: "shanghai" },
  { key: "Asia/Tokyo", localeKey: "tokyo" },
  { key: "Australia/Sydney", localeKey: "sydney" },
  { key: "Pacific/Norfolk", localeKey: "norfolk" },
];
