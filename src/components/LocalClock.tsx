"use client";
import { useEffect, useState } from "react";

/* The date/time readout under the logo — a decorative touch carried over
   from the original theme. Renders in the visitor's own local time, updated
   once a minute (seconds would be needless re-renders for a decorative
   element nobody is timing anything by). Empty on the server so hydration
   never mismatches a timezone-dependent string. */

function format(d: Date) {
  const date = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}   ${time}`;
}

export default function LocalClock({ className }: { className?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(format(new Date()));
    const t = setInterval(() => setText(format(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  // reserves the line's height before the client value lands, so nothing shifts
  return <div className={className}>{text || " "}</div>;
}
