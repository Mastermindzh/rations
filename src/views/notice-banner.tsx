import type { Notice } from "./notice.js";

type NoticeBannerProps = {
  notice: Notice;
  role?: "alert" | "status";
};

type ErrorNoticeProps = {
  message: string | undefined;
};

export const NoticeBanner = ({
  notice,
  role = "status",
}: NoticeBannerProps) => {
  return (
    <div class={`notice notice-${notice.kind}`} role={role}>
      {notice.message}
    </div>
  );
};

export const ErrorNotice = ({ message }: ErrorNoticeProps) => {
  return message ? (
    <div class="notice notice-error" role="alert">
      {message}
    </div>
  ) : null;
};
