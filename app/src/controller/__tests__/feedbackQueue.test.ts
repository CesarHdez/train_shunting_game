/// <reference types="jest" />
import { createFeedbackQueue } from '../feedbackQueue';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('createFeedbackQueue', () => {
  it('does not play immediately when queued', () => {
    const q = createFeedbackQueue(1000);
    const play = jest.fn();
    q.queue(play);
    expect(play).not.toHaveBeenCalled();
    expect(q.size()).toBe(1);
  });

  it('plays exactly once when flushed by the completion callback', () => {
    const q = createFeedbackQueue(1000);
    const play = jest.fn();
    q.queue(play);
    q.flushOldest();
    expect(play).toHaveBeenCalledTimes(1);
    expect(q.size()).toBe(0);

    // The safety-net timer for the flushed item must not also fire it.
    jest.advanceTimersByTime(2000);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('plays exactly once via the safety net when no completion callback ever arrives', () => {
    const q = createFeedbackQueue(1000);
    const play = jest.fn();
    q.queue(play);
    jest.advanceTimersByTime(999);
    expect(play).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(q.size()).toBe(0);

    // A later, unrelated flushOldest() must not double-play the already-flushed item.
    q.flushOldest();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('does not play when there is nothing queued', () => {
    const q = createFeedbackQueue(1000);
    expect(() => q.flushOldest()).not.toThrow();
  });

  it('is FIFO across rapid consecutive moves and never drops or duplicates', () => {
    const q = createFeedbackQueue(1000);
    const first = jest.fn();
    const second = jest.fn();
    q.queue(first);
    q.queue(second);
    expect(q.size()).toBe(2);

    q.flushOldest();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    q.flushOldest();
    expect(second).toHaveBeenCalledTimes(1);
    expect(q.size()).toBe(0);

    jest.advanceTimersByTime(5000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('clear() cancels all pending items without playing them, and cancels their timers', () => {
    const q = createFeedbackQueue(1000);
    const play = jest.fn();
    q.queue(play);
    q.clear();
    expect(q.size()).toBe(0);

    jest.advanceTimersByTime(5000);
    expect(play).not.toHaveBeenCalled();

    // flushOldest() after clear() is a safe no-op.
    expect(() => q.flushOldest()).not.toThrow();
    expect(play).not.toHaveBeenCalled();
  });

  it('a stale safety-net timer for an already-cleared item never fires after new items are queued', () => {
    const q = createFeedbackQueue(1000);
    const stale = jest.fn();
    const fresh = jest.fn();
    q.queue(stale);
    q.clear();
    q.queue(fresh);

    jest.advanceTimersByTime(1000);
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});
