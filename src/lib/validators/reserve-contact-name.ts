/** 公開予約・変更フォームの代表者名（teams.contact_name は text だが UI/API で上限を揃える） */

export const RESERVE_CONTACT_NAME_MAX_CHARS = 120;

export function isReserveContactNameOk(trimmedName: string): boolean {
  return trimmedName.length > 0 && trimmedName.length <= RESERVE_CONTACT_NAME_MAX_CHARS;
}
