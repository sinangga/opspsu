import {
  STREAMLINE_BASE_URL,
  STREAMLINE_FILENAME_PREFIX,
  STREAMLINE_FILENAME_SUFFIX,
  STREAMLINE_INTERVAL_HOURS,
} from "./constants";

export type StreamlineSlot = "A" | "B";

export type StreamlineImage = {
  slot: StreamlineSlot;
  label: string;
  timestamp: string;
  remoteUrl: string;
};

export function formatDatePart(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return { y, m, d };
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function alignUtcHour(date: Date, hour: number) {
  const aligned = new Date(date.getTime());
  aligned.setUTCHours(hour, 0, 0, 0);
  return aligned;
}

export function buildStreamlineTimestamp(date: Date) {
  const { y, m, d } = formatDatePart(date);
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${y}${m}${d}${hour}0000`;
}

export function buildStreamlineRemoteUrl(timestamp: string) {
  return `${STREAMLINE_BASE_URL}${STREAMLINE_FILENAME_PREFIX}${timestamp}${STREAMLINE_FILENAME_SUFFIX}`;
}

export function buildStreamlineLabel(date: Date) {
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${hour} UTC`;
}

export function buildStreamlinePairs(now: Date): StreamlineImage[] {
  const isAfterNoon = now.getUTCHours() >= 12;
  const primaryHour = isAfterNoon ? 12 : 0;
  const primaryDate = alignUtcHour(now, primaryHour);
  const secondaryDate = addHours(primaryDate, -STREAMLINE_INTERVAL_HOURS);

  return ["A", "B"].map((slot, index) => {
    const targetDate = index === 0 ? primaryDate : secondaryDate;
    const timestamp = buildStreamlineTimestamp(targetDate);
    return {
      slot: slot as StreamlineSlot,
      label: buildStreamlineLabel(targetDate),
      timestamp,
      remoteUrl: buildStreamlineRemoteUrl(timestamp),
    };
  });
}
