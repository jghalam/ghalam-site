# SplitEase changelog

## 2.7.4

- Section headings (Expenses, Settle up, Activity) are now bold serif headings in full-contrast text instead of small dim uppercase labels
- Share, Show/Hide Activity, and Delete event are now solid-filled buttons instead of outlined/transparent, for better visibility — especially over a custom event background

## 2.7.3

- Fixed: on narrow screens the event title block (logo, name, invite link) could overlap the back button and "+ Add expense" button instead of wrapping below them — the flex layout was letting it shrink to fit rather than break onto its own line. It now always sits on its own row underneath the button row, at any screen width

## 2.7.2

- When an event has a custom background, the whole content area now sits on a translucent panel (not just individual cards), with cards, expense rows, the status banner, and empty-state messages slightly more opaque on top of that. Previously only cards had any tint, so headings, section labels, and the space between boxes sat directly on the raw photo and were hard to read

## 2.7.1

- Fixed: the event background image was applied to the scrolling content block instead of the page itself, so it never showed in the margins around the content or stayed fixed while scrolling. It's now applied to the page background directly, with the cards still floating semi-transparent on top

## 2.7.0

- Replaced the profile pencil icon with a settings gear (⚙). Clicking it opens a menu: "Edit profile" (the same name/Venmo/PayPal panel as before) or "Appearance…"
- Appearance, opened from the home screen: choose Light Mode (default) or Dark Mode — persists on this device, applied instantly with no flash on reload
- Appearance, opened from inside an event: the event creator can upload a background image and a logo for that specific event, visible to everyone in it. Images are resized and compressed client-side before saving (stored directly on the event record — no separate file storage needed). Non-creators see a note that only the creator can change it
- When an event has a custom background, all the cards, boxes, and panels shift to a 90%-opaque version of their background so the image shows through faintly without hurting readability. The event's logo appears to the left of its name
- Firestore rules: event-document updates (needed for background/logo) are now restricted to the event's creator, matching how event deletion already worked

## 2.6.1

- Footer now anchors to the bottom of the viewport on short pages (e.g. the landing screen with few events) instead of floating up right under the content. On longer pages it stays at the natural end of the content as before

## 2.6.0

- Home screen: each event row's Leave/Delete button is now a "⋯" menu with Share and Leave/Delete options, instead of a standalone action button
- Event view: Home moved to a top-left back-arrow icon; the copy icon next to the invite link is now a share icon and performs the full Share (native share sheet with copy fallback); the separate "Share Event" button was removed since it's now redundant

## 2.5.0

- Top bar and footer are now a light blue band; "Your events" and "Join an event" now have a light green background
- Replaced the inline "Start a new event" box with a "+ New Event" button in the top-right of the top bar, opening a popup for the event name
- Event view: removed the "Add an expense" box — the button now lives in the top button row next to Home and Share Event, separated by dividers
- Delete event moved to a centered button at the bottom of the event view, above the footer
- Added a copy icon next to the invite link
- "Copy invite link" replaced with "Share Event," using the device's native share sheet (text/email/etc.) when available, falling back to copying the link on platforms without share support
- Settle Up and Activity are now boxed in cards with a light background, and Settle Up always shows a message instead of going blank when there's nothing to settle yet

## 2.4.0

- Switched to a light theme: white page background, dark text, and every accent color (blue, gold, green, coral, purple) darkened for readable contrast on white instead of the previous dark-theme-tuned shades. Updated the toggle switch, browser theme-color, and app manifest colors to match
- Activity log now defaults to collapsed, with an explicit Show/Hide button instead of relying on clicking the label
- "Add an expense" is now a button that opens the form in a modal/sheet, instead of the form always sitting open inline — applies to both adding a new expense and editing an existing one

## 2.3.2

- Fixed: the expense Date field could overflow its card on mobile Safari — iOS renders `<input type="date">` with native OS chrome that doesn't reliably respect CSS width/box-sizing. Stripped the native appearance so it sizes like every other field

## 2.3.1

- Fixed: the logo and name badge were each `position: fixed`, pinned to the viewport — scrolling the page would drag in-flow content (like the event topbar) up underneath them, causing visible overlap on mobile. They're now combined into a single sticky top bar with a solid background that occupies normal page space, so nothing scrolls behind it

## 2.3.0

- The join screen ("What's your name?") now also shows optional Venmo and PayPal.me fields with an explanation of what they're for, so people discover payment linking at the moment they join instead of only by noticing the profile ✎ later. Prefilled from your saved profile if you've already set them; saved the same way either path

## 2.2.0

- The "Your events" list on the home screen now shows each event's status as a colored dot next to its name (gray = new, purple = in progress, green = closed), with a legend at the top of the card. Status is fetched live when the list loads, same logic as the in-event banner

## 2.1.0

- Avatar hover tooltips now spell out what the color means (e.g. "Purple — adding expenses") instead of just the status
- Added a small persistent color legend under "Who's in," since hover tooltips don't work reliably on mobile touch
- Increased the size of the logo and app name in the top-left corner

## 2.0.1

- The automatic "un-marked as done" that happens when you add or edit an expense now logs its own activity entry (e.g. "Bot T added 'Groceries' — automatically un-marked as done"), so it's visible in the feed why someone's status — and potentially the event's — changed, not just that it changed

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
