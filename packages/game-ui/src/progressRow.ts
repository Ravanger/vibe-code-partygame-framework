/** One player's row in a ProgressStrip: who they are, how much they have handed in and their current mark. */
export interface ProgressRow {
  /** The player's id; the strip keys its rows by it. */
  playerId: string;
  /** The display name under the sticker. */
  name: string;
  /** How many of the expected items this player has handed in. */
  answered: number;
  /** How many items this player must hand in. */
  expected: number;
  /** Whether the player is done; renders the done mark. */
  done: boolean;
  /** Whether the player is working right now; renders the typing mark and label. */
  typing: boolean;
  /** Whether this is the viewer's own row; underlines the name. */
  isMe: boolean;
}
