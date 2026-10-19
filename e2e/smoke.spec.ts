import { expect, test } from "@playwright/test";

test("renders the name, tagline and logo", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("zach lefin");
  await expect(page.getByRole("heading", { name: "zach lefin" })).toBeVisible();
  await expect(
    page.getByText("agentic engineer, tinkerer, and linux enjoyer"),
  ).toBeAttached();
  await expect(
    page.getByRole("img", { name: "Zach Lefin logo" }),
  ).toBeVisible();
});

test("links point to the right places", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "GitHub", exact: true }),
  ).toHaveAttribute("href", "https://github.com/zalefin");
  await expect(page.getByRole("link", { name: "LinkedIn" })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/zalefin/",
  );
  await expect(page.getByRole("link", { name: /copy email/i })).toHaveAttribute(
    "href",
    "mailto:zachlefin@gmail.com",
  );
  await expect(
    page.getByRole("link", { name: "source on github" }),
  ).toHaveAttribute("href", "https://github.com/zalefin/zalefin.github.io");
});

test("theme follows the OS and the toggle switches it", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(html).toHaveClass(/light/);

  await page.reload();
  await expect(html).toHaveClass(/light/);
});

test("clicking the email copies it and shows a toast", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("link", { name: /copy email/i }).click();
  await expect(page.getByRole("status")).toContainText(
    "copied zachlefin@gmail.com",
  );
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "zachlefin@gmail.com",
  );
});

test("unknown paths get the segfault page", async ({ page }) => {
  await page.goto("/no/such/page");
  await expect(
    page.getByText("Segmentation fault (core dumped)"),
  ).toBeVisible();
  await expect(page.getByText("$ ./zachlef.in /no/such/page")).toBeVisible();
  await page.getByRole("link", { name: "cd ~" }).click();
  await expect(page.getByRole("heading", { name: "zach lefin" })).toBeVisible();
});
