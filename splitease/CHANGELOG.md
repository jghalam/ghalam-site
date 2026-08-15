# SplitEase changelog

## 1.2.0

- Added the SplitEase logo to the header, clickable to return to the home screen; added an explicit "← Home" button inside events too
- "Your events" is now split into "Created by you" and "Joined" groups, each sorted by most recently opened
- Events you created can be deleted directly from the home list (with a warning), no need to open them first
- Events you joined can be left directly from the home list — removes your name and deletes any expenses you added in that event
- Leaving an event from inside it (the × on your own name) now also deletes your own expenses, matching the home-list "Leave" behavior
- Fixed: deleting an event now also cleans up its activity log entries (previously left orphaned in Firestore)
- Fixed: navigating between events no longer stacks up duplicate real-time listeners

## 1.1.0

- Landing screen now shows "Your events" — a list of events you've created or joined before on this browser, so you don't need the original link to get back in
- Stale entries (events that were deleted) are cleaned up automatically when you try to open them

## 1.0.0 — initial release

- Create or join an event via a shareable link — no accounts, backed by Firebase Anonymous Auth
- Log expenses with a description, amount, and a selectable subset of participants to split with (never an automatic even split among everyone)
- Live-updating participant list, expense log, and settle-up summary via Firestore listeners
- Settle-up calculation minimizes the number of payments needed to net everyone out
- Edit or delete expenses you added; the payer is locked once an expense is created (delete and re-add to change it)
- Only the event creator can delete the event — enforced in Firestore security rules, not just hidden in the UI
- Removing a participant immediately returns them to the join screen on their own device
- Activity log showing recent joins, expenses added/edited/deleted, and removals
- In-app "How it works" help panel
- Favicon, app icons, and web manifest generated from the SplitEase logo
