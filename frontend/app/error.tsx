"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>The workspace could not open.</h1>
      <p>
        Your saved projects are still stored. Try loading the workspace again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
