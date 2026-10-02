import { LOBBY_PHASE } from "@partygame/shared";
import { PHASE } from "../src/phaseNames.js";
import { CLASH_BONUS, POINTS_PER_VOTE, WINNER_BONUS } from "../src/scoring.js";
import type { Matchup, WitClashState } from "../src/state.js";

const TIE_BREAKER_BONUS = 1;

/** Turns successive room states into the lines a spectator would read, each line once. */
export class Narrator {
  private readonly told = new Set<string>();
  private readonly revealPoints = new Map<string, number>();
  private readonly names = new Map<string, string>();
  private roster = "";
  private notice = "";
  private inGame = false;

  /** New lines for this state; call it on every state change. */
  update(state: WitClashState): string[] {
    const lines: string[] = [];
    this.learnNames(state);
    if (state.phase === LOBBY_PHASE) this.lobby(state, lines);
    else this.inGame = true;
    this.categories(state, lines);
    this.matchupVoting(state, lines);
    for (const [index, matchup] of [...state.matchups].entries()) {
      this.reveal(`${state.roundNumber}:${matchup.id}`, matchup, index, state, lines);
    }
    this.tieBreaker(state, lines);
    if (state.phase === PHASE.Results) this.results(state, lines);
    return lines;
  }

  /** Where the scoreboard disagrees with the points the reveals showed; empty when it adds up. */
  discrepancies(state: WitClashState): string[] {
    if (state.scoreboard.length === 0) return ["The scoreboard is empty"];
    return [...state.scoreboard].flatMap((row) => {
      const bonus = row.wonTieBreaker ? TIE_BREAKER_BONUS : 0;
      const shown = (this.revealPoints.get(row.playerId) ?? 0) + bonus;
      return row.score === shown
        ? []
        : [`${row.name}: scoreboard says ${row.score}, the reveals add up to ${shown}`];
    });
  }

  private learnNames(state: WitClashState): void {
    for (const seat of state.players.values()) this.names.set(seat.id, seat.name);
    for (const row of state.scoreboard) this.names.set(row.playerId, row.name);
  }

  private once(key: string): boolean {
    if (this.told.has(key)) return false;
    this.told.add(key);
    return true;
  }

  private count(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? "" : "s"}`;
  }

  private lobby(state: WitClashState, lines: string[]): void {
    if (this.inGame) {
      this.inGame = false;
      this.told.clear();
      this.revealPoints.clear();
    }
    const named = [...state.players.values()].filter((seat) => seat.name !== "");
    const roster = named.map((seat) => seat.name).join(", ");
    if (roster !== this.roster) {
      this.roster = roster;
      lines.push(`Lobby, ${this.count(named.length, "player")}: ${roster}`);
    }
    if (state.notice !== this.notice) {
      this.notice = state.notice;
      if (state.notice) lines.push(state.notice);
    }
  }

  private categories(state: WitClashState, lines: string[]): void {
    const round = state.roundNumber;
    if (state.phase === PHASE.CategorySelection && this.once(`cat:${round}`)) {
      lines.push("", `=== Round ${round} of ${state.totalRounds} ===`, "Categories offered:");
      for (const [index, option] of [...state.categoryOptions].entries()) {
        lines.push(`  ${index + 1}) ${option.name}`);
      }
    }
    if (state.phase !== PHASE.Prompting || !this.once(`prompting:${round}`)) return;
    const chosen = state.categoryOptions.find((option) => option.id === state.selectedCategory);
    if (chosen) {
      lines.push(`Category chosen: ${chosen.name} (${this.count(chosen.votes, "vote")})`);
    }
    lines.push("Everyone is writing answers...");
  }

  private matchupVoting(state: WitClashState, lines: string[]): void {
    const matchup = state.matchups[state.activeMatchupIndex];
    if (state.phase !== PHASE.MatchupVoting || !matchup) return;
    const key = `${state.roundNumber}:${matchup.id}`;
    if (!this.once(`vote:${key}`)) return;
    this.heading(matchup, state.activeMatchupIndex, state.matchups.length, lines);
    this.listAnswers(matchup, lines);
  }

  private heading(matchup: Matchup, index: number, total: number, lines: string[]): void {
    lines.push("", `Matchup ${index + 1} of ${total}: ${matchup.promptText}`);
  }

  private listAnswers(matchup: Matchup, lines: string[]): void {
    for (const [index, answer] of [...matchup.answers].entries()) {
      lines.push(`  ${index + 1}) "${answer.text}"`);
    }
  }

  private reveal(
    key: string,
    matchup: Matchup,
    index: number,
    state: WitClashState,
    lines: string[],
  ): void {
    if (!matchup.isRevealed || !this.once(`reveal:${key}`)) return;
    if (!this.told.has(`vote:${key}`)) this.heading(matchup, index, state.matchups.length, lines);
    if (matchup.isForfeit) lines.push("  Only one answer came in, so it wins without a vote.");
    for (const answer of matchup.answers) {
      const bonus = answer.isWinner ? WINNER_BONUS + (matchup.isClash ? CLASH_BONUS : 0) : 0;
      const points = answer.votes * POINTS_PER_VOTE + bonus;
      this.revealPoints.set(
        answer.authorId,
        (this.revealPoints.get(answer.authorId) ?? 0) + points,
      );
      const mark = answer.isWinner ? (matchup.isClash ? " - CLASH, winner" : " - winner") : "";
      lines.push(
        `  "${answer.text}" by ${answer.authorName}: ${this.count(answer.votes, "vote")}, +${points} points${mark}`,
      );
    }
  }

  private tieBreaker(state: WitClashState, lines: string[]): void {
    const attempt = state.tieBreakers.length;
    const latest = state.tieBreakers[attempt - 1];
    if (state.phase === PHASE.TieBreakerPrompting && this.once(`tb-prompt:${attempt}`)) {
      const names = [...state.tieBreakerContenders].map((id) => this.names.get(id) ?? id);
      lines.push(
        "",
        `TIE-BREAKER: ${names.join(" and ")} are level at the top and answer one more prompt.`,
      );
    }
    if (!latest) return;
    if (state.phase === PHASE.TieBreakerVoting && this.once(`tb-vote:${attempt}`)) {
      lines.push(`Tie-breaker prompt: ${latest.promptText}`);
      this.listAnswers(latest, lines);
    }
    if (!latest.isRevealed || !this.once(`tb-reveal:${attempt}`)) return;
    if (latest.isForfeit) lines.push("  Only one answer came in, so it wins without a vote.");
    for (const answer of latest.answers) {
      const mark = answer.isWinner ? " - winner" : "";
      lines.push(
        `  "${answer.text}" by ${answer.authorName}: ${this.count(answer.votes, "vote")}${mark}`,
      );
    }
  }

  private results(state: WitClashState, lines: string[]): void {
    if (!this.once(`results:${state.roundNumber}`)) return;
    const final = state.isFinalRound;
    lines.push(
      "",
      final ? "=== Final scores ===" : `=== Scores after round ${state.roundNumber} ===`,
    );
    state.scoreboard.forEach((row, index) => {
      const notes = [
        row.hasLeft ? "left" : "",
        row.wonTieBreaker ? "won the tie-breaker" : "",
        row.roundPoints > 0 ? `+${row.roundPoints} this round` : "",
      ].filter((note) => note !== "");
      const suffix = notes.length > 0 ? ` (${notes.join(", ")})` : "";
      lines.push(`  ${index + 1}. ${row.name}: ${row.score}${suffix}`);
    });
    if (!final) return;
    lines.push(this.winnerLine(state));
    for (const best of state.bestAnswers) {
      lines.push(
        `Best answer: "${best.text}" by ${best.authorName} for "${best.promptText}" (${this.count(best.votes, "vote")})`,
      );
    }
  }

  private winnerLine(state: WitClashState): string {
    const seated = state.scoreboard.filter((row) => !row.hasLeft);
    const top = Math.max(...seated.map((row) => row.score));
    const winners = seated.filter((row) => row.score === top);
    const decided = winners.find((row) => row.wonTieBreaker);
    if (decided) return `Winner: ${decided.name} with ${top} points`;
    const label = winners.length > 1 ? "Winners (shared)" : "Winner";
    return `${label}: ${winners.map((row) => row.name).join(", ")} with ${top} points`;
  }
}
