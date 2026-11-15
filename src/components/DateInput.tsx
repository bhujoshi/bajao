"use client";
import { InputHTMLAttributes } from "react";
export default function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} onClick={event=>{props.onClick?.(event);try {event.currentTarget.showPicker?.();} catch {/* Native keyboard/date controls remain available. */}}} />;
}
