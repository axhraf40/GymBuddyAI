"use client";

import React from "react";

/** Lightweight safe markdown renderer (bold, italic, bullet lists, [S1] citation pills). */
export function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");

  const renderInline = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[S\d+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-forest-deep">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
        return (
          <em key={i} className="italic text-secondary">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (/^\[S\d+\]$/.test(part)) {
        return (
          <span
            key={i}
            className="mx-0.5 inline-block rounded-full bg-lime/60 px-1.5 py-0.2 text-[10px] font-bold text-forest-deep"
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-ink">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}
