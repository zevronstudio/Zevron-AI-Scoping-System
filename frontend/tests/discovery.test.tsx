import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/agent/composer";
import { IdeaStart } from "@/components/agent/idea-start";
import { ScopeContent } from "@/components/project/scope-view";
import { projectSchema } from "@/types/project";

describe("discovery controls", () => {
  it("populates starter ideas without submitting", () => {
    const choose = vi.fn();
    render(<IdeaStart onChoose={choose} disabled={false} />);
    fireEvent.click(
      screen.getByRole("button", { name: "A website for my clinic" }),
    );
    expect(choose).toHaveBeenCalledWith("I need a website for my clinic.");
  });
  it("blocks empty messages and supports multiline input", () => {
    const send = vi.fn();
    const { rerender } = render(
      <Composer
        value=" "
        onChange={vi.fn()}
        onSend={send}
        busy={false}
        disabled={false}
        hasMessages={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
    rerender(
      <Composer
        value="A clinic"
        onChange={vi.fn()}
        onSend={send}
        busy={false}
        disabled={false}
        hasMessages={false}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      shiftKey: true,
    });
    expect(send).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("blocks duplicate submissions while busy", () => {
    const send = vi.fn();
    render(
      <Composer
        value="Clinic"
        onChange={vi.fn()}
        onSend={send}
        busy
        disabled
        hasMessages
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });
  it("renders structured features and treats HTML as text", () => {
    render(
      <ScopeContent
        value={[
          {
            name: "Booking",
            items: ["<script>bad()</script>", "Confirm by email"],
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Booking" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(document.querySelector("script")).toBeNull();
  });
  it("rejects an incompatible API payload", () => {
    expect(
      projectSchema.safeParse({ id: "invalid", state: null }).success,
    ).toBe(false);
  });
});
