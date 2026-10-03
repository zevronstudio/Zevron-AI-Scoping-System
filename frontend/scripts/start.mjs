import { cp, mkdir } from "node:fs/promises";

// Next's standalone server needs static assets alongside its generated entrypoint.
const staticTarget = new URL(
  "../.next/standalone/.next/static/",
  import.meta.url,
);
await mkdir(staticTarget, { recursive: true });
await cp(new URL("../.next/static/", import.meta.url), staticTarget, {
  recursive: true,
});
process.env.HOSTNAME ||= "127.0.0.1";
await import("../.next/standalone/server.js");
