// Lab session logic: progress, first and next item to play, end of session, hash.
import { describe, expect, it } from 'vitest';
import {
  canPlay, firstToPlay, nextToPlay, sessionDone, sessionPlayHash, sessionProgress, sessionSize, toPlay, type SessionItem, type SessionState,
} from '../src/lab/logic';

const item = (position: number, state: SessionState, over: Partial<SessionItem> = {}): SessionItem => ({
  position, lot: 'l', index: position - 1, number: position, state, attempts: state === 'todo' ? 0 : 1, playable: true, ...over,
});

describe('session progress', () => {
  const items = [item(1, 'solved'), item(2, 'abandoned'), item(3, 'todo'), item(4, 'solved')];
  it('counts solved items over the total', () => expect(sessionProgress(items)).toEqual({ solved: 2, total: 4 }));
  it('first to play is the first not solved (an abandoned one is played again)', () => {
    expect(firstToPlay(items)?.position).toBe(2);
    expect(firstToPlay([item(1, 'solved')])).toBeUndefined();
  });
});

describe('hold and unplayable items', () => {
  const held = item(1, 'todo', { hold: 'en attente de correctif' });
  const ramp = item(2, 'todo', { playable: false });
  it('cannot be launched', () => {
    expect(canPlay(held)).toBe(false);
    expect(canPlay(ramp)).toBe(false);
    expect(toPlay(held)).toBe(false);
  });
  it('are skipped by the next item and do not block the end', () => {
    const items = [held, ramp, item(3, 'todo')];
    expect(firstToPlay(items)?.position).toBe(3);
    expect(sessionDone([held, ramp, item(3, 'solved')])).toBe(true);
    expect(sessionDone(items)).toBe(false);
  });
});

describe('next item after a game', () => {
  const items = [item(1, 'solved'), item(2, 'solved'), item(3, 'todo', { hold: 'x' }), item(4, 'todo'), item(5, 'abandoned')];
  it('takes the following unresolved, launchable item, no wrap-around', () => {
    expect(nextToPlay(items, 2)?.position).toBe(4);
    expect(nextToPlay(items, 4)?.position).toBe(5);
    expect(nextToPlay(items, 5)).toBeUndefined();
  });
  it('ignores items before the current one', () => expect(nextToPlay([item(1, 'todo'), item(2, 'solved')], 2)).toBeUndefined());
});

describe('session done', () => {
  it('is true when nothing is left to play', () => expect(sessionDone([item(1, 'solved'), item(2, 'solved')])).toBe(true));
  it('is false while an abandoned item remains', () => expect(sessionDone([item(1, 'solved'), item(2, 'abandoned')])).toBe(false));
  it('is true for an empty session', () => expect(sessionDone([])).toBe(true));
});

describe('hash', () => {
  it('carries the session id after the lot and the 0-based index', () =>
    expect(sessionPlayHash('v3-session-1', { lot: 'nuit-rampe', index: 2 })).toBe('#/partie/nuit-rampe/2/v3-session-1'));
});

describe('size of a new session', () => {
  it('defaults to 16, capped to the lot', () => {
    expect(sessionSize('', 40)).toBe(6);
    expect(sessionSize('  ', 4)).toBe(4);
  });
  it('accepts an integer from 1 and caps it to the lot size', () => {
    expect(sessionSize('8', 40)).toBe(8);
    expect(sessionSize('99', 20)).toBe(20);
  });
  it('refuses what is not a positive integer', () => {
    for (const bad of ['0', '-3', '2.5', 'abc']) expect(sessionSize(bad, 40)).toBeNull();
  });
});
