"use client";

import { useState, useEffect } from "react";

const Ascii = () => {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const text = [
    "██████╗██╗     ███████╗ █████╗ ██████╗  ██████╗██╗   ██╗████████╗",
    "██╔════╝██║     ██╔════╝██╔══██╗██╔══██╗██╔════╝██║   ██║╚══██╔══╝",
    "██║     ██║     █████╗  ███████║██████╔╝██║     ██║   ██║   ██║   ",
    "██║     ██║     ██╔══╝  ██╔══██║██╔══██╗██║     ██║   ██║   ██║   ",
    "╚██████╗███████╗███████╗██║  ██║██║  ██║╚██████╗╚██████╔╝   ██║   ",
    " ╚═════╝╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝    ╚═╝   ",
  ];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    if (mediaQuery.matches) {
      setVisibleLines(text.map((line, i) => (i ? " " + line : line)));
    } else {
      const timers: NodeJS.Timeout[] = [];

      text.forEach((line, i) => {
        const displayLine = i ? " " + line : line;
        const t = setTimeout(() => {
          setVisibleLines((v) => [...v, displayLine]);
        }, i * 120);
        timers.push(t);
      });

      return () => {
        timers.forEach((t) => clearTimeout(t));
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return (
    <div data-text={text}>
      <pre
        className="ascii-art max-w-4xl mx-auto pt-4 pb-1
                     font-mono text-[0.6rem] md:text-base
                     whitespace-pre overflow-x-auto leading-none text-center"
        style={{
          fontFamily: `ui-monospace, SFMono-Regular, "SF Mono", Consolas,
                        "Liberation Mono", Menlo, monospace`,
        }}
      >
        {visibleLines.join("\n")}
      </pre>
    </div>
  );
};

export default Ascii;
