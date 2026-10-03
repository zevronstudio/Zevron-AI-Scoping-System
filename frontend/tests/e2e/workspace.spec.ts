import { expect, test } from "@playwright/test";

test("discovery → scope → revise → restore → export → delete", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("textbox")).toBeEnabled();
  await page.getByRole("button", { name: "A website for my clinic" }).click();
  await expect(page.getByRole("textbox")).toHaveValue(
    "I need a website for my clinic.",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Who approves appointments?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox")
    .fill("Staff approves appointments. Send confirmations by email.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Prepare brief", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "01Executive summary" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revise Executive summary", exact: true })
    .click();
  await page
    .getByLabel("Your revision")
    .fill("Make the summary easier to understand.");
  await page
    .getByRole("button", { name: "Update section", exact: true })
    .click();
  await expect(
    page.getByText("A clear booking website for patients and clinic staff.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Clinic booking", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Project brief" }).click();
  await expect(page.getByLabel("Brief version")).toHaveValue("2");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/brief-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByLabel("Brief version").selectOption("1");
  await expect(
    page.getByText("Clinic appointment booking", { exact: true }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "clinic-booking-brief.md",
  );
  await page.getByRole("button", { name: "Rename project" }).click();
  await page.getByLabel("Project name").fill("Northside clinic");
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(
    page
      .getByRole("heading", { name: "Northside clinic", exact: true })
      .first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Let’s give your idea a clear direction.",
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("missing provider configuration is explicit", async ({ page }) => {
  await page.route("**/api/v1/health", (route) =>
    route.fulfill({ json: { status: "ok", discovery_available: false } }),
  );
  await page.goto("/");
  await expect(
    page.getByText(/The discovery advisor isn’t connected yet/),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("textbox")).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width < 768) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await page.screenshot({
      path: `test-results/workspace-${width}.png`,
      fullPage: true,
    });
  });
}

test("API error preserves draft and retry succeeds", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("textbox")).toBeEnabled();
  let fail = true;
  await page.route("**/api/v1/projects/*/messages", async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 504,
        json: {
          error: { message: "The advisor took too long. Please retry." },
        },
      });
    } else await route.continue();
  });
  await page.getByRole("textbox").fill("I need a clinic website");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Please retry" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveValue(
    "I need a clinic website",
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByText("Who approves appointments?", { exact: true }),
  ).toBeVisible();
});
