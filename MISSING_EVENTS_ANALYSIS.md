# React Native SDK - Missing Events Analysis

This document analyzes potential causes for missing events in the React Native Events SDK, particularly in production environments with challenging network conditions.

## Executive Summary

Based on code analysis of the SDK, I've identified **7 potential causes** for missing events. The most critical issues relate to:
1. No network request timeout configuration
2. No retry mechanism for failed uploads
3. Race condition in the dequeue logic
4. Flush skipping when upload is in progress
5. Background flush timing limitations

---

## Potential Causes of Missing Events

### 1. **No Network Timeout Configuration** ⚠️ HIGH RISK

**Location**: `packages/core/src/api.ts`

```typescript
export const uploadEvents = async ({ writeKey, url, events }) => {
  return await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ batch: events, sentAt: new Date().toISOString(), writeKey }),
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
```

**Issue**: The `fetch()` call has no timeout configuration. On weak or intermittent networks, requests can hang indefinitely:
- If a request hangs, the `isPendingUpload` flag stays `true` (see Issue #4)
- Subsequent flushes are skipped
- Events accumulate but never get sent
- The app may eventually be terminated by the OS while waiting

**Impact**: Events queued during a hanging network request will never be sent.

**Recommendation**: Add an `AbortController` with a timeout (e.g., 30 seconds):
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
try {
  return await fetch(url, { ...options, signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```

---

### 2. **No Retry Mechanism for Failed Uploads** ⚠️ HIGH RISK

**Location**: `packages/core/src/plugins/HightouchDestination.ts` (lines 48-66)

```typescript
await Promise.all(
  chunkedEvents.map(async (batch: HightouchEvent[]) => {
    try {
      const res = await uploadEvents({ writeKey, url, events: batch });
      checkResponseForErrors(res);
      sentEvents = sentEvents.concat(batch);
    } catch (e) {
      this.analytics?.reportInternalError(translateHTTPError(e));
      this.analytics?.logger.warn(e);
      numFailedEvents += batch.length;
    } finally {
      await this.queuePlugin.dequeue(sentEvents);
    }
  })
);
```

**Issue**: When a network request fails:
- The error is logged, but no retry is attempted
- Events remain in the queue and will only be retried on the next flush trigger
- If network issues persist (e.g., user in a tunnel), multiple flush cycles may fail
- If the app is terminated before the next successful flush, events are lost from persistence

**Impact**: Transient network failures can cause events to be delayed indefinitely or lost if the app terminates.

**Recommendation**: Implement exponential backoff retry (e.g., 3 retries with 1s, 2s, 4s delays).

---

### 3. **Race Condition in Dequeue Logic** ⚠️ HIGH RISK

**Location**: `packages/core/src/plugins/HightouchDestination.ts` (lines 48-66)

```typescript
await Promise.all(
  chunkedEvents.map(async (batch: HightouchEvent[]) => {
    try {
      // ... upload attempt ...
      sentEvents = sentEvents.concat(batch);
    } catch (e) {
      // ... error handling ...
    } finally {
      await this.queuePlugin.dequeue(sentEvents);  // BUG: Called inside each map iteration!
    }
  })
);
```

**Issue**: The `dequeue()` call is inside the `finally` block of each parallel batch upload. This means:
- If we have 4 batches and batches 1 and 3 succeed while 2 and 4 are still in progress...
- Batch 1 completes: `dequeue([events from batch 1])` - ✓
- Batch 3 completes: `dequeue([events from batch 1])` again! (sentEvents is shared closure)
- This could lead to incorrect dequeue operations or missed events

Additionally, `sentEvents` is being mutated from multiple concurrent async operations without synchronization, creating a classic race condition.

**Impact**: Events may be dequeued multiple times or not at all, depending on timing.

**Recommendation**: Move dequeue outside the `Promise.all` loop and use proper accumulation:
```typescript
const results = await Promise.allSettled(chunkedEvents.map(...));
const successfulEvents = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
await this.queuePlugin.dequeue(successfulEvents);
```

---

### 4. **Flush Skipping When Upload In Progress** ⚠️ MEDIUM RISK

**Location**: `packages/core/src/plugins/QueueFlushingPlugin.ts` (lines 62-72)

```typescript
async flush() {
  const events = (await this.queueStore?.getState(true))?.events ?? [];
  if (!this.isPendingUpload) {
    try {
      this.isPendingUpload = true;
      await this.onFlush(events);
    } finally {
      this.isPendingUpload = false;
    }
  }
  // Note: If isPendingUpload is true, flush is silently skipped!
}
```

**Issue**: When `isPendingUpload` is `true`, the flush is **silently skipped**. Combined with Issue #1:
- If a network request hangs for a long time, `isPendingUpload` stays `true`
- All subsequent flush triggers (timer, count, background) are ignored
- New events keep being queued but never uploaded
- When the app goes to background, the background flush is also skipped

**Impact**: During slow network conditions, new events won't be uploaded until the hanging request completes.

**Recommendation**: Either queue the flush request to execute after the current one completes, or implement a timeout that resets `isPendingUpload`.

---

### 5. **Timer Flush Policy Resets on Every Event** ⚠️ MEDIUM RISK

**Location**: `packages/core/src/flushPolicies/timer-flush-policy.ts` (lines 36-39)

```typescript
onEvent(_event: HightouchEvent): void {
  // Reset interval
  this.startTimer();
}
```

**Issue**: The timer is reset on **every** event. In high-activity apps:
- User triggers many events in quick succession
- Timer keeps resetting, never reaching the flush interval
- Events only flush when user stops activity (timer expires) OR count threshold is reached
- If count threshold is set high (or infinite), events may never flush via timer

With `flushAt: 1` and `flushInterval: 30`, this shouldn't be a major issue, but combined with Issue #4, if a flush is in progress, new events won't trigger additional flushes.

**Impact**: In very active usage patterns with slow networks, flushes may be delayed.

---

### 6. **Background Flush Timing Is Racy** ⚠️ MEDIUM RISK

**Location**: `packages/core/src/flushPolicies/background-flush-policy.ts`

```typescript
this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
  if (this.appState === 'active' && ['inactive', 'background'].includes(nextAppState)) {
    this.shouldFlush.value = true;
  }
});
```

**Issue**: On iOS, when the app goes to background:
1. `AppState` transitions to 'inactive' then 'background' very quickly
2. The OS gives very limited time for network operations before suspending the app
3. The SDK's async flush operation may not complete before the app is suspended
4. If `isPendingUpload` is already `true` from a previous flush, this background flush is skipped entirely

**Note**: The `BackgroundFlushPolicy` also doesn't update `this.appState` after transitions, but this is actually not a bug because we want to flush on every `active → background/inactive` transition.

**Impact**: Events tracked just before backgrounding may not be sent if a previous flush is still in progress or if the flush doesn't complete in time.

**Recommendation**: Consider using iOS Background Tasks API or Android WorkManager for more reliable background uploads.

---

### 7. **Events Sent Without `isReady` Check Can Be Lost** ⚠️ LOW-MEDIUM RISK

**Location**: `packages/core/src/plugins/HightouchDestination.ts` (lines 27-31)

```typescript
private sendEvents = async (events: HightouchEvent[]): Promise<void> => {
  if (!this.isReady) {
    // We're not sending events until Hightouch has loaded all settings
    return Promise.resolve();  // Events are silently not sent!
  }
  // ...
};
```

**Issue**: If `flush()` is called before `isReady` becomes `true`:
- Events are passed to `sendEvents()`
- `sendEvents()` returns immediately without uploading
- However, the events are still dequeued in the `finally` block!

Wait, let me verify this... Actually, looking more closely, if `isReady` is false, the function returns early BEFORE the upload logic, so events stay in queue. But the `flush()` in `QueueFlushingPlugin` doesn't dequeue unless `sendEvents` does. So this should be safe.

**Corrected Assessment**: This is actually handled correctly - events remain queued if not ready.

---

## Additional Observations

### Storage Persistence
- Events are persisted using Sovran store with async persistence
- The `saveDelay` configuration can cause events to not be persisted if the app terminates quickly
- Default `saveDelay` is 0, which should persist immediately

### No Offline Queue Management
- There's no logic to handle offline scenarios specially
- No exponential backoff or circuit breaker patterns
- Failed events simply wait for the next flush trigger

---

## Recommendations Summary

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| **P0** | No timeout on fetch | Add AbortController with 30s timeout |
| **P0** | No retry on failure | Add exponential backoff retry (3 attempts) |
| **P0** | Race condition in dequeue | Move dequeue outside Promise.all loop |
| **P1** | Flush skipping | Queue flush requests or add timeout for isPendingUpload |
| **P1** | Background flush timing | Use platform-specific background task APIs |
| **P2** | Timer reset behavior | Consider debouncing instead of resetting |

---

## Reproducing the Issue

The customer (StashAway) reports:
- Missing events only in production
- Issue partially mitigated by `flushAt: 1` and background flush enabled
- Likely hitting edge cases with weak network or prolonged offline periods

To reproduce, simulate:
1. Start with active network
2. Track several events
3. Trigger flush (should start upload)
4. Immediately switch to airplane mode or very slow network
5. While upload is hanging, track more events
6. Go to background
7. Force-quit the app
8. Check if events from step 5 were received

The events from step 5 would likely be lost because:
- Background flush was skipped (pending upload from step 3)
- App terminated before network recovered
- Events may not have persisted if `saveDelay` > 0

---

## Files Analyzed

- `packages/core/src/api.ts` - Network upload function
- `packages/core/src/plugins/QueueFlushingPlugin.ts` - Event queue management
- `packages/core/src/plugins/HightouchDestination.ts` - Event sending logic
- `packages/core/src/analytics.ts` - Main client class
- `packages/core/src/flushPolicies/` - All flush policies
- `packages/core/src/storage/sovranStorage.ts` - Persistence layer
- `packages/core/src/errors.ts` - Error handling
