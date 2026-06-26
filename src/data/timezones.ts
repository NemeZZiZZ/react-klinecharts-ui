export interface TimezoneOption {
  key: string;
  localeKey: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { key: "Etc/UTC", localeKey: "utc", offset: "UTC+0" },
  { key: "Pacific/Honolulu", localeKey: "honolulu", offset: "UTC-10" },
  { key: "America/Juneau", localeKey: "juneau", offset: "UTC-9" },
  { key: "America/Los_Angeles", localeKey: "los_angeles", offset: "UTC-7" },
  { key: "America/Chicago", localeKey: "chicago", offset: "UTC-5" },
  { key: "America/Toronto", localeKey: "toronto", offset: "UTC-4" },
  { key: "America/Sao_Paulo", localeKey: "sao_paulo", offset: "UTC-3" },
  { key: "Europe/London", localeKey: "london", offset: "UTC+1" },
  { key: "Europe/Berlin", localeKey: "berlin", offset: "UTC+2" },
  { key: "Asia/Bahrain", localeKey: "bahrain", offset: "UTC+3" },
  { key: "Asia/Dubai", localeKey: "dubai", offset: "UTC+4" },
  { key: "Asia/Ashkhabad", localeKey: "ashkhabad", offset: "UTC+5" },
  { key: "Asia/Almaty", localeKey: "almaty", offset: "UTC+6" },
  { key: "Asia/Bangkok", localeKey: "bangkok", offset: "UTC+7" },
  { key: "Asia/Shanghai", localeKey: "shanghai", offset: "UTC+8" },
  { key: "Asia/Tokyo", localeKey: "tokyo", offset: "UTC+9" },
  { key: "Australia/Sydney", localeKey: "sydney", offset: "UTC+10" },
  { key: "Pacific/Norfolk", localeKey: "norfolk", offset: "UTC+11" },
];
