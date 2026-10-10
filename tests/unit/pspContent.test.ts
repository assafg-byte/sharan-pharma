import { describe, it, expect } from "vitest";
import { buildDefaultContent, normalizeContent } from "@/lib/psp/defaultContent";
import { FLOW, screenDef } from "@/lib/psp/screens";

const EXT = "ebg-extend-plan";
const tasksOf = (c: ReturnType<typeof buildDefaultContent>, screen: string) =>
  c.programs.ebglyss.screens[screen].groups.flatMap(g => g.tasks);

/** A document saved before the change: no patches list, no extend task, no new screen. */
function oldStoredDoc() {
  const c = JSON.parse(JSON.stringify(buildDefaultContent()));
  delete c.patches;
  c.programs.ebglyss.screens.E_NODIR.groups[0].tasks = c.programs.ebglyss.screens.E_NODIR.groups[0].tasks.filter((t: { id: string }) => t.id !== EXT);
  delete c.programs.ebglyss.screens.E_NODIR.texts.note;
  delete c.programs.ebglyss.screens.V_TASKS.texts.note;
  delete c.programs.ebglyss.screens.E_NODIR24;
  return c;
}

describe("Ebglyss no-instruction screens", () => {
  it("week 24 'no instruction' leads to its own screen, week 16 keeps the old one", () => {
    expect(screenDef("ebglyss", "E_W24")!.answers!.find(a => a.key === "nodir")!.to).toBe("E_NODIR24");
    expect(screenDef("ebglyss", "E_W16")!.answers!.find(a => a.key === "nodir")!.to).toBe("E_NODIR");
    expect(FLOW.ebglyss.map(s => s.id)).toContain("E_NODIR24");
  });

  it("fresh defaults: week 16 has the extension task, week 24 has the two extra rows + disclaimers", () => {
    const c = buildDefaultContent();
    expect(tasksOf(c, "E_NODIR").map(t => t.title)).toContain("הארכת תוכנית התזכורות");
    expect(tasksOf(c, "E_NODIR24")).toHaveLength(4);
    expect(c.programs.ebglyss.screens.E_NODIR24.texts.note).toContain("מעבר לשבוע 24");
    expect(c.programs.ebglyss.screens.V_TASKS.texts.note).toContain("אין להפסיק תוכנית תזכורות");
  });

  it("an already-saved document gets the new row, notes and screen — once", () => {
    const once = normalizeContent(oldStoredDoc());
    expect(tasksOf(once, "E_NODIR").filter(t => t.id === EXT)).toHaveLength(1);
    expect(once.programs.ebglyss.screens.E_NODIR.texts.note).toContain("אחת לשבועיים");
    expect(once.programs.ebglyss.screens.V_TASKS.texts.note).toBeTruthy();
    expect(tasksOf(once, "E_NODIR24")).toHaveLength(4);
    expect(once.patches).toContain("ebg-nodir16-extend-plan");

    const twice = normalizeContent(JSON.parse(JSON.stringify(once)));
    expect(tasksOf(twice, "E_NODIR").filter(t => t.id === EXT)).toHaveLength(1);
  });

  it("a row an admin deleted after the patch is not added back", () => {
    const saved = normalizeContent(oldStoredDoc());
    saved.programs.ebglyss.screens.E_NODIR.groups[0].tasks = saved.programs.ebglyss.screens.E_NODIR.groups[0].tasks.filter(t => t.id !== EXT);
    const reloaded = normalizeContent(JSON.parse(JSON.stringify(saved)));
    expect(tasksOf(reloaded, "E_NODIR").some(t => t.id === EXT)).toBe(false);
  });
});
