"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";
import { useTheme } from "@/lib/use-theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <Button
      variant="ghost"
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      aria-label={
        mounted && theme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      title={
        mounted && theme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
    >
      {mounted && theme === "dark" ? (
        <Sun size={17} className="theme-icon theme-icon--sun" />
      ) : (
        <Moon size={17} className="theme-icon theme-icon--moon" />
      )}
      <span className="theme-label">
        {mounted && theme === "dark" ? "Light" : "Dark"}
      </span>
    </Button>
  );
}
