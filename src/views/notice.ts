export type Notice = {
  kind: "success" | "error" | "info";
  message: string;
};

const STATUS_NOTICES: Record<string, Notice> = {
  saved: { kind: "success", message: "Configuration saved successfully." },
  delayed: { kind: "success", message: "The two assignments were swapped." },
  rescheduled: { kind: "success", message: "The game-night date was updated." },
};

export function noticeFromStatus(
  status: string | undefined,
): Notice | undefined {
  return status ? STATUS_NOTICES[status] : undefined;
}
