/** 公開 API・予約画面で共有する昼食メニュー（税込のみ） */
export type LunchMenuItemPublic = {
  id: string;
  name: string;
  description: string | null;
  priceTaxIncluded: number;
  sortOrder: number;
};

/** 予約に紐づく明細（スナップショット済み） */
export type ReservationLunchLinePublic = {
  menuItemId: string | null;
  itemName: string;
  unitPriceTaxIncluded: number;
  quantity: number;
  lineTotal: number;
};
