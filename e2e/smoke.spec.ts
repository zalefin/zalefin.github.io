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
  await expect(page.getByText("copied zachlefin@gmail.com")).toBeVisible();
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

test.describe("DAG editor", () => {
  // Pyodide loads from the jsDelivr CDN, which takes a few seconds.
  test.setTimeout(90_000);

  test("compiles the shipped DAG, then edits", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: /edit dag/ }).click();
    const status = page.locator("#dag-editor").getByRole("status");
    await expect(status).toContainText("✓ zach_lefin · 25 tasks", {
      timeout: 60_000,
    });

    await page
      .locator(".cm-content")
      .fill(
        [
          'with DAG(dag_id="hello"):',
          '    a = MadeUpOperator(task_id="a")',
          "",
          "    @task",
          "    def b(): ...",
          "",
          "    a >> b()",
        ].join("\n"),
      );
    await page.getByRole("button", { name: "▶ compile" }).click();
    await expect(status).toContainText("✓ hello · 2 tasks · 1 edges");

    await page
      .locator(".cm-content")
      .fill('with DAG("x"):\n    Fine(task_id="a")\n    oops()\n');
    await page.locator(".cm-content").press("ControlOrMeta+Enter");
    await expect(status).toContainText(
      "NameError: name 'oops' is not defined (line 3)",
    );

    await page.getByRole("button", { name: "reset" }).click();
    await expect(status).toContainText("✓ zach_lefin · 25 tasks");
  });

  test("opens and closes as a dropdown", async ({ page }) => {
    await page.goto("/");
    const editor = page.locator("#dag-editor");
    const toggle = page.getByRole("button", { name: /edit dag/ });
    await expect(editor).toBeHidden();
    await toggle.click();
    await expect(editor).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.getByRole("button", { name: "Close the DAG editor" }).click();
    await expect(editor).toBeHidden();
  });
});
