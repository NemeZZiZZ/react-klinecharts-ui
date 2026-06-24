---
title: useTimezone
description: Manage the chart timezone.
sidebar:
  order: 5
---

Manage the chart timezone.

```ts
const { timezones, activeTimezone, setTimezone } = useTimezone();
```

| Field | Type | Description |
| ----- | ---- | ----------- |
| `timezones` | `TimezoneItem[]` | Full list of timezones |
| `activeTimezone` | `string` | Current IANA timezone key |
| `setTimezone` | `(timezone: string) => void` | Change the timezone |

```ts
interface TimezoneItem {
  key: string; // IANA: "Europe/London", "America/New_York", "UTC"
  localeKey: string; // short name: "london", "new_york", "utc"
}
```

**Available timezones:** `UTC`, `Pacific/Honolulu`, `America/Juneau`,
`America/Los_Angeles`, `America/Chicago`, `America/Toronto`,
`America/Sao_Paulo`, `Europe/London`, `Europe/Berlin`, `Asia/Bahrain`,
`Asia/Dubai`, `Asia/Ashkhabad`, `Asia/Almaty`, `Asia/Bangkok`, `Asia/Shanghai`,
`Asia/Tokyo`, `Australia/Sydney`, `Pacific/Norfolk`.

## Usage

```tsx
const { timezones, activeTimezone, setTimezone } = useTimezone();

<select value={activeTimezone} onChange={(e) => setTimezone(e.target.value)}>
  {timezones.map((tz) => (
    <option key={tz.key} value={tz.key}>
      {tz.key}
    </option>
  ))}
</select>;
```
