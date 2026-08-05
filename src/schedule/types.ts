export type GameNightOccurrence = {
  gameNightId: string;
  date: string;
  originalDate?: string;
  personId: string;
  originalPersonId: string;
  isOverride: boolean;
  reason?: string;
  turnNumber: number;
};
