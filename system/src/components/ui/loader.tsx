"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoaderProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

export function Loader({ size = "md", className, text }: LoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-primary", sizeClasses[size])} />
      {text && <span className={cn("text-muted-foreground animate-pulse", textSizeClasses[size])}>{text}</span>}
    </div>
  );
}

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return <Loader2 className={cn("animate-spin text-primary", sizeClasses[size], className)} />;
}

interface LoadingOverlayProps {
  text?: string;
  className?: string;
}

export function LoadingOverlay({ text = "Ładowanie...", className }: LoadingOverlayProps) {
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50", className)}>
      <Loader size="lg" text={text} />
    </div>
  );
}

interface LoadingStateProps {
  text?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingState({ text = "Ładowanie danych...", className, size = "md" }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 gap-4", className)}>
      <div className="relative">
        <div className={cn("rounded-full border-4 border-muted animate-pulse", size === "sm" ? "h-8 w-8" : size === "md" ? "h-12 w-12" : "h-16 w-16")} />
        <div className={cn("absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin", size === "sm" ? "h-8 w-8" : size === "md" ? "h-12 w-12" : "h-16 w-16")} />
      </div>
      {text && <p className="text-sm text-muted-foreground animate-pulse">{text}</p>}
    </div>
  );
}

// Dots loading animation
interface DotsLoaderProps {
  className?: string;
  text?: string;
}

export function DotsLoader({ className, text }: DotsLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className="flex gap-1">
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
        <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
      </div>
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

// Pulse loader for cards
interface PulseLoaderProps {
  className?: string;
}

export function PulseLoader({ className }: PulseLoaderProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative flex h-10 w-10">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40" />
        <span className="relative inline-flex rounded-full h-10 w-10 bg-primary/60" />
      </div>
    </div>
  );
}
