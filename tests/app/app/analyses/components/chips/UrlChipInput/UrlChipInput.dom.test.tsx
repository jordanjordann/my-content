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
    expect(input).toHaveAttribute("aria-describedby", screen.getByRole("status").id);
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

  it("does not destroy already-typed text when a URL is pasted in", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");

    const typedText = "https://www.instagram.com/reel/abc123/";
    fireEvent.change(input, { target: { value: typedText } });

    const clipboardData = {
      getData: vi.fn().mockReturnValue("https://www.youtube.com/shorts/bbb"),
    };
    fireEvent.paste(input, { clipboardData });

    expect(screen.getByText("/shorts/bbb")).toBeInTheDocument();
    expect(input).toHaveValue(typedText);
  });

  it("merges already-typed text with a rejected pasted URL instead of dropping either", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");

    const typedText = "not-a-url-yet";
    fireEvent.change(input, { target: { value: typedText } });

    const clipboardData = { getData: vi.fn().mockReturnValue("https://vimeo.com/2") };
    fireEvent.paste(input, { clipboardData });

    expect(input).toHaveValue(`${typedText} https://vimeo.com/2`);
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

/**
 * Ticket #322 — `handlePaste` looped over every accepted URL and called `onAdd` synchronously,
 * so `maxChips` (only consumed by `isFull`, which gates the next render) never stopped a single
 * paste from exceeding the cap. These tests assert the cap is enforced within the paste itself,
 * and that over-cap URLs are put back in the input rather than dropped.
 */
describe("UrlChipInput — paste respects maxChips (ticket #322)", () => {
  function makeInstagramUrls(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `https://www.instagram.com/reel/url${i}/`);
  }

  it("pastes 20 valid URLs into an empty field: exactly 10 chips, cap message, 10 preserved for when space frees up", () => {
    render(<Harness maxChips={10} />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");
    const urls = makeInstagramUrls(20);

    const clipboardData = { getData: vi.fn().mockReturnValue(urls.join(" ")) };
    fireEvent.paste(input, { clipboardData });

    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByText("Maximum 10 URLs reached")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Only 10 more URL(s) can be added — maximum is 10",
    );

    // The input unmounts while full (existing isFull behaviour, untouched by this fix), but
    // the leftover value is preserved in state -- removing a chip re-mounts the input with the
    // 10 over-cap URLs still there, proving they were not silently dropped.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByPlaceholderText("Paste or type URLs...")).toHaveValue(
      urls.slice(10).join(" "),
    );
  });

  it("adds 8 chips then pastes 5 valid URLs: 10 total, 3 left in the input, message names the remaining count", () => {
    function EightThenPasteHarness() {
      const [chips, setChips] = useState<UrlChip[]>(
        makeInstagramUrls(8).map((url) => ({ url })),
      );
      return (
        <UrlChipInput
          chips={chips}
          onAdd={(url) => setChips((prev) => [...prev, { url }])}
          onRemove={(i) => setChips((prev) => prev.filter((_, idx) => idx !== i))}
          maxChips={10}
        />
      );
    }

    render(<EightThenPasteHarness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");
    const urls = [
      "https://www.instagram.com/reel/new0/",
      "https://www.instagram.com/reel/new1/",
      "https://www.instagram.com/reel/new2/",
      "https://www.instagram.com/reel/new3/",
      "https://www.instagram.com/reel/new4/",
    ];

    const clipboardData = { getData: vi.fn().mockReturnValue(urls.join(" ")) };
    fireEvent.paste(input, { clipboardData });

    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Only 2 more URL(s) can be added — maximum is 10",
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByPlaceholderText("Paste or type URLs...")).toHaveValue(
      urls.slice(2).join(" "),
    );
  });

  it("pastes exactly 10 valid URLs into an empty field: 10 chips, empty input, no cap message", () => {
    render(<Harness maxChips={10} />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");
    const urls = makeInstagramUrls(10);

    const clipboardData = { getData: vi.fn().mockReturnValue(urls.join(" ")) };
    fireEvent.paste(input, { clipboardData });

    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(input).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("pastes 3 valid URLs into an empty field: 3 chips, no message (no regression)", () => {
    render(<Harness maxChips={10} />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");
    const urls = makeInstagramUrls(3);

    const clipboardData = { getData: vi.fn().mockReturnValue(urls.join(" ")) };
    fireEvent.paste(input, { clipboardData });

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("shows only the cap message (not the invalid-URL message) when a paste is both over-cap and mixed with invalid URLs", () => {
    function NineThenPasteHarness() {
      const [chips, setChips] = useState<UrlChip[]>(
        makeInstagramUrls(9).map((url) => ({ url })),
      );
      return (
        <UrlChipInput
          chips={chips}
          onAdd={(url) => setChips((prev) => [...prev, { url }])}
          onRemove={(i) => setChips((prev) => prev.filter((_, idx) => idx !== i))}
          maxChips={10}
        />
      );
    }

    render(<NineThenPasteHarness />);
    const input = screen.getByPlaceholderText("Paste or type URLs...");
    // 1 slot remaining. Paste 3 valid (only 1 fits) plus 1 invalid.
    const text = [
      "https://www.instagram.com/reel/mixA/",
      "https://www.instagram.com/reel/mixB/",
      "https://www.instagram.com/reel/mixC/",
      "not-a-url",
    ].join(" ");

    const clipboardData = { getData: vi.fn().mockReturnValue(text) };
    fireEvent.paste(input, { clipboardData });

    expect(screen.getAllByRole("button")).toHaveLength(10);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    // Exact match (not substring) proves the cap message is the ONLY thing rendered --
    // it is not stacked with the invalid-URL message even though both would otherwise apply.
    expect(screen.getByRole("status").textContent).toBe(
      "Only 1 more URL(s) can be added — maximum is 10",
    );

    // Free a slot to re-mount the input and pin the exact merged leftover value: the
    // over-cap accepted URLs (mixB, mixC) followed by the rejected URL (not-a-url), proving
    // none of the three paste operands (typed text, over-cap accepted, rejected) were dropped.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.getByPlaceholderText("Paste or type URLs...")).toHaveValue(
      "https://www.instagram.com/reel/mixB/ https://www.instagram.com/reel/mixC/ not-a-url",
    );
  });
});
