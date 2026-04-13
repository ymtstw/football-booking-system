-- 予約締切と status の仕様を DB コメントに反映（実装ロジックは変更しない）。

COMMENT ON FUNCTION public.create_public_reservation(
  uuid, uuid, text, text, text, text, text, integer, integer, text, text
) IS
'公開予約作成。event_days.status=open かつ reservation_deadline_at 前のみ。locked は締切と自動同期しない（docs/spec/reservation-deadline-and-event-status.md）。service_role / Route Handler のみ。';

COMMENT ON FUNCTION public.cancel_public_reservation(text) IS
'公開予約取消。event_days.status=open かつ締切前のみ。locked は締切と自動同期しない（docs/spec/reservation-deadline-and-event-status.md）。service_role / Route Handler のみ。';
