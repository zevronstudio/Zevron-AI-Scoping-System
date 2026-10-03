import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
const python =
  process.env.E2E_PYTHON ||
  path.resolve(
    "..",
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    channel: "chrome",
  },
  webServer:
    process.env.E2E_EXTERNAL_SERVERS === "1"
      ? undefined
      : [
          {
            command: `"${python}" -m uvicorn tests.e2e_app:app --host 127.0.0.1 --port 8100`,
            cwd: "../backend",
            url: "http://127.0.0.1:8100/api/v1/health",
            reuseExistingServer: false,
          },
          {
            command: "npm run dev -- --port 3100",
            url: "http://localhost:3100",
            env: { BACKEND_URL: "http://127.0.0.1:8100" },
            reuseExistingServer: false,
            timeout: 120000,
          },
        ],
});
