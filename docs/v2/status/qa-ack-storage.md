# QA-ack-storage — durable outbox acknowledgement recovery

Owner: QA/ORC · Branch: `v2/qa-ack-storage-recovery` · Status: review

## Risk
A remote write could succeed while device storage refused the subsequent deletion of its outbox entry. The app previously removed the operation from memory regardless, leaving an old copy on disk. Reloading could replay the acknowledged write and overwrite a newer remote value; the user saw no indication that local cleanup had failed.

## Change
- Mark a remotely acknowledged operation in memory, but remove it from the queue only after its account-scoped storage update succeeds.
- Skip acknowledged operations during same-session reconnect and subsequent pumps, preventing duplicate remote writes while local cleanup is pending.
- Retry failed outbox cleanup every five seconds, fenced to the originating account and database adapter. A successful later enqueue may also reconcile the old acknowledgement.
- Show an accessible, persistent sync-cleanup warning until durable recovery; clear it on recovery and on account teardown.
- Add Node regression coverage for persistent cleanup failure, new-edit rejection, eventual recovery, reconnect, and account switches.
- Add Playwright smoke with 390/1280 light/dark warning screenshots.

## Limit
No client-only change can guarantee exactly-once remote writes if the device is forcibly closed while local storage cannot record the acknowledgement. The queue remains at-least-once after such a reload. This patch makes the failure visible and prevents repeated writes during the live session; server-side idempotency would require a separate contract review.

No new permissions, recipients, services, schema changes, production data mutations or v1 feature removals. L6 PR #44 remains draft; physical-device gates #49/#52 are unchanged.

## Evidence
- [ ] Node and web build CI on final PR head.
- [ ] Browser acceptance and navigation audit on final PR head.
- [ ] Four QA-ack-storage screenshots inspected.
- [ ] ORC review and merge after gates pass.
