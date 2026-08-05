# Testing Guide — What You Can Try Right Now

_A plain-English guide. No technical knowledge needed._
_This is a living document — it gets updated as the tool grows._
_Last updated: 5 August 2026_

---

## What this tool is, in one paragraph

This is a tool for studying Instagram and YouTube videos — either your clients' content, or content from creators you want to learn from. You paste in a link to a video. The tool watches it using AI and hands you back a detailed breakdown: what worked, what didn't, a score, and specific suggestions to improve. Later on, it will also learn a specific creator's personal style from a batch of their videos, so it can help write new video briefs that sound like that creator. That last part isn't ready for you to use yet — more on that below.

---

## Test this now — quick checklist

Work through these in order. Each one is explained in more detail further down.

- [ ] **1.** Open the app and set up (or enter) your 4-digit PIN
- [ ] **2.** Paste a video link on the main screen and run an analysis
- [ ] **3.** Find that video in the list of past analyses
- [ ] **4.** Filter and search that list
- [ ] **5.** Click into one analysis and read the full breakdown
- [ ] **6.** Re-run an analysis, then delete an entry

That's everything that's real and clickable today. If you can do all six, the tool is working as intended.

---

## The six things, explained

### 1. Logging in — the PIN screen

The whole tool sits behind a 4-digit PIN, like a phone lock screen.

- **First time ever:** the app shows a simple form asking you to create a 4-digit PIN. Type one in. That's it — nothing technical to do.
- **Every time after:** it asks for that same PIN before letting you in.

**Known limitation (not a bug):** if the PIN is ever forgotten, resetting it currently needs a developer's help. You can't do it yourself from that screen. Worth knowing before you hand the tool to anyone else.

### 2. The main screen — analyzing a video

Paste a link to any of these:

- an Instagram Reel
- an Instagram carousel post (the swipeable multi-image/video posts)
- a YouTube Short

Click to start. You'll see a progress indicator while the tool goes and fetches the video, then has the AI watch and analyze it. When it finishes, the video shows up in your list.

**What to watch for:** does the progress indicator actually move and finish? Do all three link types work?

### 3. The list of past analyses

Everything you've ever analyzed appears in a table you can scroll through. Right in the table — without opening anything — you can see basic numbers like view counts and like counts.

### 4. Filtering and searching the list

You can narrow the table down by things like which account or creator the video came from, which platform it's on, and whether the analysis succeeded or failed. You can also search by keyword.

**This is the one area we'd most like you to poke at properly.** Specific things worth trying:

- Turn on **several filters at once** — does the list narrow down correctly?
- **Search by keyword** — do you get sensible matches?
- Filter the list, then **reload the page** (or copy the web address and open it fresh). Does it still show the same filtered view? It should.
- Filter down to something with **no results at all**. Does the screen look deliberate and calm, or does it look broken?

### 5. Opening one analysis in detail

Click into any analyzed video. You get the full breakdown:

- an overall **score**
- a **scorecard** — ratings across specific categories like hook strength, pacing, and structure
- written notes on **strengths, weaknesses, key moments, and red flags**
- concrete **suggestions for improvement**
- a **style breakdown** — what kind of hook it used, what call-to-action it had, how the video was structured moment-to-moment
- **view and like counts**, plus anything unusual about them. For example, if a creator has hidden their like count, the tool says so honestly rather than inventing a number. Check that this reads clearly when it happens.

### 6. Managing the list

Two actions on any entry:

- **Re-run** the analysis — useful if something changed, or you just want a second pass.
- **Delete** the entry entirely.

---

## What you might spot but should ignore

There's a second, **card-style view** of the list sitting in the tool. It isn't properly reachable through the app right now, so don't test it and don't judge it. It's not part of what's shipped.

---

## Built but not yet visible: creator style-learning

This is the feature that watches at least 5 videos from one creator and builds a profile of their personal style — typical hooks, pacing, tone — so the tool can later help write new content briefs that sound like that specific creator.

**Status:** the whole thing was finished this session. It can read a creator's learned style, and a person can manually correct anything the tool got wrong about that style.

**But:** there is currently **no screen anywhere in the app** where you can see or touch any of it. Think of it as a finished engine with no dashboard bolted on yet.

This is deliberate, not a fault. The screen that would show all this — most likely a page for each creator — hasn't been built, because we're waiting on **your decision about where in the app it should live**.

**So:** don't try to test this, and don't worry that you can't find it. Nothing is missing.

---

## Where things stand — reference for the next session

### Recent progress

**Creator style-learning was fully built.** The complete underlying system for learning a creator's style, reading it back, and letting a human correct it is done. It just has no screen yet.

**The AI analysis system was verified with a real live test.** We wanted to be certain it hands back a complete, correctly-formed answer every single time — not most of the time. It was tested at the strictest consistency setting (in plain terms: the AI was told "give the most consistent answer possible, don't be creative or random"). It passed.

**A new automated testing tool was added.** From now on, any new feature involving clickable, on-screen elements can be checked automatically, the same way the rest of the tool already is. This is invisible to you but means fewer surprises later.

### What's still open

**Three manual checks remain:**

| Check | Ready? |
| --- | --- |
| The filter bar on the main list | **Ready now** — see section 4 above |
| A deeper review of the whole scoring/analysis system | Not yet — needs more building first |
| A deeper review of how the tool fetches Instagram data | Not yet — same reason |

**The one big decision waiting on you:** where should the creator style-learning screen live in the app? Until that's decided and the screen is built, that entire feature stays invisible and untestable. **This is the single biggest thing blocking progress on it.**

---

## Related documents

This guide is a plain-language companion, not a replacement. The detailed technical handoff notes live alongside it in this same folder (the `HANDOFF-` files) and are written for developers.
