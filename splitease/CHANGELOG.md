# SplitEase changelog

## 2.0.0

- Added event status: **New** (no expenses yet), **In progress** (expenses logged, not everyone's done), **Closed** (everyone's marked themselves done) — shown as a color-coded banner at the top of the event, computed live from participant/expense data (nothing new stored on the event itself)
- Added a "Done adding expenses?" switch for each person. Adding or editing an expense automatically un-marks you as done, since you're clearly still active
- Participant avatars now reflect status by color instead of a fixed per-person color: red (no expenses yet), purple (adding expenses), green (done) — hover for a text label
- Settle-up now shows a warning when not everyone's finished, and marking something Paid or clicking a Pay via Venmo/PayPal link while the event isn't Closed prompts a confirmation first rather than blocking outright

## 1.9.1

- Clicking "Pay via Venmo" or "Pay via PayPal" now opens the link as before, then shows a follow-up prompt — "Sent $X to Name?" — so marking it paid is one tap away instead of hunting for the switch. Auto-dismisses after 12 seconds if ignored, and doesn't assume the payment happened; you still confirm it yourself

## 1.9.0

- Added optional Venmo and PayPal.me handles to your profile (via the name-edit panel, now "Your profile"), shared across events the same way your name is
- Settle-up rows now show "Pay via Venmo" / "Pay via PayPal" buttons for whoever owes money, when the person they owe has a handle saved — opens the other app/site with the amount and a note pre-filled; the payer still confirms it themselves, same as everywhere else Venmo/PayPal are used this way (Splitwise does the same)
- These are convenience links only, not a verified payment integration — nothing confirms the payment actually happened, so the existing Paid switch is still how you mark it settled

## 1.8.0

- Added a date field to expenses, defaulting to today. Shown in the expense list ("Jan 5 · Paid by..."); editable when adding or editing an expense. Existing expenses logged before this update just won't show a date until edited and saved

## 1.7.0

- Only the event creator can now remove someone else from the event — the "×" on other people's chips is hidden for everyone else, enforced in the rules as well as the UI. Leaving on your own is still always available on your own chip
- Added a "Paid" text label next to the settle-up switch so its purpose is clear regardless of state

## 1.6.0

- Removing or leaving now retroactively cleans up expenses instead of leaving orphaned "Someone" references: your own logged expenses are deleted, and you're stripped out of the split on everyone else's (recalculating their share correctly, or deleting the expense if the split would be empty)
- Fixed: after being removed from an event, the app no longer silently rejoins you on your next visit or reload — you'll see a "You were removed" notice and have to explicitly rejoin (your name is still pre-filled for convenience)

## 1.5.0

- Moved the SplitEase title and tagline beside the logo in a single compact lockup, fixed to the top-left of the page — replaces the old large centered hero header
- Removed the "How it works" button and its help panel

## 1.4.1

- Fixed a deeper race behind the "joined twice" bug — most reproducible by getting removed by someone else and then reloading. The join decision was being made synchronously right after opening an event, before any real participant data had arrived, so it could act on stale (empty) state instead of the real list. It now always waits for the first real snapshot before deciding whether to auto-join, show the join form, or reclaim an existing record

## 1.4.0

- "Your events" on the home screen now checks each event with Firestore before displaying it, so a deleted event no longer lingers in your list until you click on it
- Settle-up entries now use a persistent Paid/Not paid switch instead of disappearing once marked — flip it back and the "Paid" label goes away, no data is deleted either way
- Removed the payer picker's replacement "Mark paid" button/balance-netting approach in favor of the toggle above (simpler, doesn't shift amounts around)
- Moved the SplitEase logo to a fixed top-left position so it no longer crowds the name badge in the top-right corner on narrow/mobile screens

## 1.3.2

- Fixed: a device could end up joined to the same event twice under the same name if a page reload landed between joining and saving that locally (e.g. auto-join firing again). Joining now also stamps each participant with the device's anonymous auth ID, and re-checks that ID before creating a new participant — an existing record is reclaimed instead of duplicated

## 1.3.1

- Fixed: deleting an event no longer fails entirely if the Firestore rules are a version behind (e.g. the `payments` subcollection added in 1.3.0 isn't yet permitted) — cleanup now skips whatever it can't access and still deletes the core event, participants, and expenses

## 1.3.0

- Your name is now entered once and reused across every event on this device — no more re-entering it each time you join. Shown top-right with an edit (✎) button; editing it updates your name on every event you're currently part of
- Fixed: opening a link to a deleted event, or having the event you're viewing get deleted by its creator, now sends you back to the home screen instead of getting stuck on "Loading event…"
- Removed the "Paid by" picker — an expense's payer is always whoever is logged in and adding it; no more logging an expense on someone else's behalf
- Participant avatars now show first + last initials (e.g. "Jane Doe" → "JD") instead of the first two letters of the full name
- Settle-up entries can now be marked "Paid" by either the payer or the payee — this records an actual payment and nets it against the computed balances, so a marked transaction drops off the list once covered

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
