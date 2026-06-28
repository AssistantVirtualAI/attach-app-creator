import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import MobileProfileSheet from "./MobileProfileSheet";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
    auth: { updateUser: async () => ({ error: null }), signOut: async () => ({}) },
  },
}));
vi.mock("@/hooks/useMplanipretLang", () => ({
  useMplanipretLang: () => ({ t: (k: string) => k, lang: "fr", setLang: () => {} }),
}));
vi.mock("@/hooks/useMplanipretTheme", () => ({
  useMplanipretTheme: () => ({ theme: "light", setTheme: () => {} }),
}));

describe("MobileProfileSheet overlay", () => {
  beforeEach(() => cleanup());

  it("renders portaled to document.body with fixed position and z-index >= 99999", () => {
    render(
      <MobileProfileSheet
        profile={{ user_id: "u1", full_name: "Test", email: "t@t.com", status: "available" }}
        reloadProfile={() => {}}
        onClose={() => {}}
      />
    );
    const overlay = screen.getByTestId("mobile-profile-sheet-overlay") as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.parentElement).toBe(document.body);
    expect(overlay.style.zIndex).toBe("99999");
    expect(overlay.className).toContain("fixed");
    expect(overlay.className).toContain("inset-0");
  });

  it("has no sibling under <body> with a higher z-index", () => {
    render(
      <MobileProfileSheet
        profile={{ user_id: "u1", status: "available" }}
        reloadProfile={() => {}}
        onClose={() => {}}
      />
    );
    const overlay = screen.getByTestId("mobile-profile-sheet-overlay") as HTMLElement;
    const z = parseInt(overlay.style.zIndex || "0", 10);
    Array.from(document.body.children).forEach((sib) => {
      if (sib === overlay || !(sib instanceof HTMLElement)) return;
      const sz = parseInt(window.getComputedStyle(sib).zIndex || "0", 10);
      if (Number.isFinite(sz)) expect(sz).toBeLessThanOrEqual(z);
    });
  });
});
