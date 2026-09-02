import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { UrlChipInput } from "@/app/app/analyses/components/chips/UrlChipInput";
import type { UrlChip } from "@/app/app/analyses/components/chips/UrlChipInput";

/**
 * Ticket #285 (TDD §4.1) — `validateUrl`'s result was computed then discarded on both the
 * Enter-key path and the paste path, so a rejected URL vanished with no explanation. These tests
 * assert the message is shown, the input keeps/receives the right text, and the live region is
 * always mounted (never conditionally rendered) per the accessibility requirement.
 */

function Harness({ maxChips }: { maxChips?: number }) {
  const [chips, setChips] = useState<UrlChip[]>([]);
  return (
    <UrlChipInput
      chips={chips}
      onAdd={(url) => setChips((prev) => [...prev, { url }])}
      onRemove={(i) => setChips((prev) => prev.filter((_, idx) => idx !== i))}
      maxChips={maxChips}
    />
  );
}

const INVALID_URL_MESSAGE = "Must be an Instagram Reel/Post or YouTube Short URL";

describe("UrlChipInput — input-level validation error (ticket #285)", () => {
  it("mounts the aria-live region before any error occurs", () => {
    render(<Harness />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("");
  });

  it.each([
    "not a url",
    "https://instagram.com/someprofile",
    "https://example.com/x",
    "https://vimeo.com/12345",
    "https://youtu.be/abc123",
    "https://youtube.com/watch?v=abc123",
    "https://www.tiktok.com/@x/video/123",
  ])("shows the error and keeps the text for a rejected URL: %s", (url) => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");

    fireEvent.change(input, { target: { value: url } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("status")).toHaveTextContent(INVALID_URL_MESSAGE);
    expect(input).toHaveValue(url);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("accepts a valid URL, clears the input, and shows no error", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");
    const url = "https://www.instagram.com/reel/Dbpny5_pPw1/";

    fireEvent.change(input, { target: { value: url } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText("/reel/Dbpny5_pPw1/")).toBeInTheDocument();
  });

  it("does nothing for whitespace-only input on Enter", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("status")).toHaveTextContent("");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("clears the error once the user types again", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");

    fireEvent.change(input, { target: { value: "not a url" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("status")).toHaveTextContent(INVALID_URL_MESSAGE);

    fireEvent.change(input, { target: { value: "not a url a" } });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("on paste, adds valid URLs, keeps rejected ones space-joined in the input, and reports a plural summary", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");

    const accepted = [
      "https://www.instagram.com/reel/aaa/",
      "https://www.youtube.com/shorts/bbb",
    ];
    const rejected = [
      "https://www.tiktok.com/@x/video/1",
      "https://vimeo.com/2",
      "not-a-url",
    ];
    const text = [...accepted, ...rejected].join(" ");

    const clipboardData = { getData: vi.fn().mockReturnValue(text) };
    fireEvent.paste(input, { clipboardData });

    expect(screen.getByText("/reel/aaa/")).toBeInTheDocument();
    expect(screen.getByText("/shorts/bbb")).toBeInTheDocument();
    expect(input).toHaveValue(rejected.join(" "));
    expect(screen.getByRole("status")).toHaveTextContent(
      "3 URLs were not added — must be an Instagram Reel/Post or YouTube Short URL",
    );
  });

  it("on paste with a single rejected URL, reuses the exact validateUrl message", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");

    const clipboardData = { getData: vi.fn().mockReturnValue("https://vimeo.com/2") };
    fireEvent.paste(input, { clipboardData });

    expect(input).toHaveValue("https://vimeo.com/2");
    expect(screen.getByRole("status")).toHaveTextContent(INVALID_URL_MESSAGE);
  });

  it("keeps the live region mounted (empty text) when the input is full", () => {
    render(<Harness maxChips={1} />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");
    fireEvent.change(input, { target: { value: "https://www.youtube.com/shorts/bbb" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Maximum 1 URLs reached")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
