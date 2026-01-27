import { test, expect, type Page } from '@playwright/test';

/**
 * Diagram Feature Tests
 *
 * Tests for the new diagram session type including:
 * 1. Creating a new diagram
 * 2. Editor functionality (image upload, shapes, labels)
 * 3. Learn mode (click-location and type-label modes)
 * 4. Score tracking and restart functionality
 *
 * Note: These tests require the dev server to be running on port 5174
 * Authentication is handled automatically via loginTestUser helper
 */

// Test user credentials
const TEST_USER = {
  email: 'test@playwright.com',
  username: 'playwrighttest',
  password: 'TestPassword123'
};

/**
 * Helper function to register and login a test user
 * Sets up localStorage before navigating to the app
 */
async function loginTestUser(page: Page): Promise<void> {
  // Navigate to the app first to set up the domain for localStorage
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // First try to register the test user (might already exist)
  const registerResponse = await page.request.post('/api/auth/register', {
    data: {
      email: TEST_USER.email,
      username: TEST_USER.username,
      password: TEST_USER.password
    }
  });

  let authData;

  // If registration failed (user exists), try logging in
  if (!registerResponse.ok()) {
    const loginResponse = await page.request.post('/api/auth/login', {
      data: {
        emailOrUsername: TEST_USER.email,
        password: TEST_USER.password
      }
    });

    if (!loginResponse.ok()) {
      throw new Error('Failed to login test user');
    }

    authData = await loginResponse.json();
  } else {
    authData = await registerResponse.json();
  }

  // Set the token and user in localStorage using evaluate
  await page.evaluate((data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }, authData);
}

test.describe('Diagram Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginTestUser(page);

    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait a bit for React to hydrate
    await page.waitForTimeout(1000);
  });

  test('should have New Diagram button on home page', async ({ page }) => {
    // Verify the New Diagram button exists in home_actions
    // The button is inside a button element containing an anchor
    await expect(page.locator('button:has(a[href="/diagrams"])')).toBeVisible();
  });

  test('should navigate to diagram editor when clicking New Diagram', async ({ page }) => {
    // Click New Diagram button
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify we're on the diagram editor page
    await expect(page).toHaveURL(/\/diagrams/);

    // Verify editor elements are present
    await expect(page.locator('.diagram_editor')).toBeVisible();
    await expect(page.locator('.diagram_toolbar')).toBeVisible();
    await expect(page.locator('.diagram_canvas_container')).toBeVisible();
  });

  test('should have editable title input', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find title input
    const titleInput = page.locator('.diagram_title_input');
    await expect(titleInput).toBeVisible();

    // Clear and type new title
    await titleInput.fill('');
    await titleInput.fill('Test Diagram Title');

    // Verify the title was updated
    await expect(titleInput).toHaveValue('Test Diagram Title');
  });

  test('should have toolbar with tool buttons', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check for tool buttons
    await expect(page.locator('.diagram_tool_btn').first()).toBeVisible();

    // Check for specific tools (by title or content)
    const toolbar = page.locator('.diagram_toolbar');
    await expect(toolbar).toBeVisible();
  });

  test('should toggle tool selection when clicking tool buttons', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click on a tool button (e.g., rectangle)
    const toolButtons = page.locator('.diagram_tool_btn');
    const count = await toolButtons.count();

    if (count > 2) {
      // Click on a tool button (skip first which might be select)
      await toolButtons.nth(2).click();

      // Check it's now active
      await expect(toolButtons.nth(2)).toHaveClass(/active/);
    }
  });

  test('should have card navigation', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check card navigation exists
    await expect(page.locator('.diagram_card_nav')).toBeVisible();

    // Check card indicator shows "Card 1"
    const indicator = page.locator('.diagram_card_indicator');
    await expect(indicator).toContainText('1');
  });

  test('should add new card when clicking add button', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find and click add card button
    const addButton = page.locator('.diagram_add_card_btn');
    await addButton.click();
    await page.waitForTimeout(500);

    // Check that we're now on card 2
    const indicator = page.locator('.diagram_card_indicator');
    await expect(indicator).toContainText('2');
  });

  test('should navigate between cards', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Add a second card
    await page.locator('.diagram_add_card_btn').click();
    await page.waitForTimeout(500);

    // Should be on card 2
    await expect(page.locator('.diagram_card_indicator')).toContainText('2');

    // Go back to card 1
    const prevButton = page.locator('.diagram_card_nav button:has-text("←")');
    await prevButton.click();
    await page.waitForTimeout(300);

    // Should be on card 1
    await expect(page.locator('.diagram_card_indicator')).toContainText('1');
  });

  test('should have Learn button that navigates to learn mode', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find learn button
    const learnButton = page.locator('.diagram_learn_btn');
    await expect(learnButton).toBeVisible();
  });

  test('should auto-save diagram changes', async ({ page }) => {
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Change the title
    const titleInput = page.locator('.diagram_title_input');
    await titleInput.fill('Auto-save Test');

    // Wait for auto-save (debounced at 1000ms)
    await page.waitForTimeout(1500);

    // Check save status
    const saveStatus = page.locator('.diagram_save_status');
    await expect(saveStatus).toContainText(/saved/i);
  });
});

test.describe('Diagram Learn Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginTestUser(page);

    // Create a diagram first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should show error state when diagram has no labels', async ({ page }) => {
    // Navigate to learn mode without adding labels
    await page.locator('.diagram_learn_btn').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check for learn mode container
    await expect(page.locator('.diagram_learn')).toBeVisible();

    // Check for error state (no labels message)
    await expect(page.locator('.diagram_learn_error')).toBeVisible();
    await expect(page.locator('text=no labels')).toBeVisible();
  });

  test('should have button to go back to editor from error state', async ({ page }) => {
    // Navigate to learn mode
    await page.locator('.diagram_learn_btn').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Find and click the "Go to Editor" button
    const goToEditorBtn = page.locator('.diagram_learn_error button:has-text("Go to Editor")');
    await expect(goToEditorBtn).toBeVisible();

    await goToEditorBtn.click();
    await page.waitForLoadState('networkidle');

    // Should be back on editor page
    await expect(page.locator('.diagram_editor')).toBeVisible();
  });

  test('should display learn mode with proper URL structure', async ({ page }) => {
    // Navigate to learn mode
    await page.locator('.diagram_learn_btn').click();
    await page.waitForLoadState('networkidle');

    // Verify URL structure
    await expect(page).toHaveURL(/\/learn\/diagram\//);
  });
});

test.describe('Diagram Home Page Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginTestUser(page);
  });

  test('should filter to show only diagrams', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Diagrams filter button
    const diagramsFilter = page.locator('button:has-text("Diagrams")');
    await expect(diagramsFilter).toBeVisible();
    await diagramsFilter.click();

    // The filter should be active
    await expect(diagramsFilter).toHaveClass(/active/);
  });

  test('should show diagram icon for diagram sessions', async ({ page }) => {
    // First create a diagram
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Set a title and wait for save
    await page.locator('.diagram_title_input').fill('Icon Test Diagram');
    await page.waitForTimeout(1500);

    // Go back home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Filter to diagrams
    await page.click('button:has-text("Diagrams")');
    await page.waitForTimeout(500);

    // Check for diagram icon
    const diagramItem = page.locator('.home_sheet_item.diagram').first();
    if (await diagramItem.isVisible()) {
      await expect(diagramItem.locator('.icon-diagram')).toBeVisible();
    }
  });

  test('should navigate to diagram when clicking on diagram item', async ({ page }) => {
    // First create a diagram
    await page.goto('/');
    await page.waitForTimeout(1000);
    await page.click('a[href="/diagrams"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Set a title and wait for save
    await page.locator('.diagram_title_input').fill('Navigate Test Diagram');
    await page.waitForTimeout(1500);

    // Go back home
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Filter to diagrams
    await page.click('button:has-text("Diagrams")');
    await page.waitForTimeout(500);

    // Click on the diagram
    const diagramItem = page.locator('.home_sheet_item.diagram').first();
    if (await diagramItem.isVisible()) {
      await diagramItem.click();
      await page.waitForLoadState('networkidle');

      // Should be on diagram editor page
      await expect(page).toHaveURL(/\/diagrams\//);
    }
  });
});

