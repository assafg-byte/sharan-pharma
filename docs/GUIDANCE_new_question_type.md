# New Question Type: התאם את הניסוח המדויק ביותר
## Match the Most Accurate Phrasing — Drag & Drop Report Exercise

---

## What is this?

A new question type where the trainee sees a **scenario** (what the patient said) and below it a **report form** with some fields filled and some blank. She drags the most accurate phrasing from an options bank into the correct blank.

This trains precise report writing — distinguishing between phrasing that *looks* professional and phrasing that actually meets documentation standards.

---

## Screen layout (top to bottom, scrollable)

1. **Header** — same as existing (LILLY CAMPUS · MOUNJARO, progress bar)
2. **Scenario card** — pink background, red right border. Contains what the patient said.
3. **Report form container** — dark blue background (#1F3864) with title "טופס דיווח". Inside it, white cards for each section:
   - Filled sections: product details (key-value fields), description (paragraph text)
   - Blank sections: yellow dashed drop zones with placeholder "גררי ניסוח לכאן"
   - Blanks are locked sequentially — blank ② is grayed out until blank ① is filled
4. **Options bank** — sticky at the bottom. Shows only the current blank's options (4 draggable cards with letter badges A/B/C/D). Auto-switches to next blank's options after correct answer.

---

## Interaction flow

1. Trainee drags an option from the bank to the blank in the form
2. **Correct:** green ✓, locks in place. Bank switches to next blank. Auto-scroll to next blank.
3. **Wrong:** red shake animation + 1-line tooltip with feedback (disappears after 2.5s). Option returns to bank.
4. After all blanks filled → "next exercise" button appears
5. After all exercises → summary screen (success rate, attempts per blank)

---

## Core principle: Generic report form

The form is NOT hardcoded to specific sections. Each exercise defines its own report structure. The renderer builds the form dynamically from the exercise data.

Different scenarios need completely different report sections:

- **Stuck pen** → product details, description, priming attempt, valve check
- **Storage issue** → product details, storage description, instruction given
- **Adverse event** → patient details, product details, event description, current status, instructions given
- **4th dose** → product details, description, photo request, gray rubber check, explanation given

Three section types exist:
- **fields** — table of filled label-value pairs (e.g. product name, dosage, batch number)
- **text** — filled paragraph (e.g. "Patient called and reported...")
- **blank** — empty drop zone where trainee drags the correct phrasing

---

## Admin panel: Manager creates exercises manually

A non-technical manager should be able to create new exercises through a simple wizard in the app. This is essential for long-term value — new scenarios come up regularly and shouldn't require a developer.

### Access
Small link at the bottom of the home screen: "ניהול תרגילים". Opens the management view.

### Management view
List of existing exercises with edit/delete buttons. "Add new exercise" button at top.

### Creation wizard — 4 steps

**Step 1 — Scenario:** Title + scenario description (what the patient said).

**Step 2 — Report sections:** Add sections one by one. For each: choose type (filled fields / filled text / blank for dragging), give it a header name, fill in the content. Drag to reorder sections.

**Step 3 — Options per blank:** For each blank defined in step 2: add 2-5 phrasing options. Mark exactly one as correct. Write 1-line feedback for each wrong option (mandatory).

**Step 4 — Preview:** Shows the exercise exactly as the trainee will see it. Must preview before saving.

### Admin features
- **Duplicate exercise** — button to clone an existing exercise for creating variations quickly
- **Export/Import JSON** — for backup and transfer between environments
- **Validation** — cannot save without: scenario text, at least 1 blank, at least 2 options per blank, exactly 1 correct per blank, feedback for every wrong option

---

## Technical requirements

- Single HTML file, no external dependencies (same as existing question types)
- HTML5 native drag-and-drop, no libraries
- Touch support mandatory (trainees use phones) — touchstart/touchmove/touchend handlers
- RTL full. English terms (Mounjaro, KwikPen, Priming, AE) render LTR inline naturally
- Mobile-first, max-width 480px
- Options shuffled on each render
- Exercises stored in localStorage (or existing DB)

---

## Content

See companion file `תרגיל_השלמת_דיווח_מאונגרו.md` for 4 ready-made exercises (10 blanks × 4 options = 40 phrasings) to convert into the exercise data structure.
