import { test, expect, chromium } from '@playwright/test';

/**
 * Sharing and Collaboration Tests
 * 
 * These tests verify:
 * 1. Share modal functionality
 * 2. Permission levels (owner, edit, view)
 * 3. Real-time collaboration
 * 4. Cursor synchronization
 */

test.describe('Sharing Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:5174');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should open share modal when clicking share button', async ({ page }) => {
    // Create a new sheet first
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);
    
    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    // Find and click the share button on the first session
    const shareButton = page.locator('.share-button').first();
    await shareButton.click();
    
    // Verify share modal is open
    await expect(page.locator('.share-modal')).toBeVisible();
    await expect(page.locator('.share-modal-header h2')).toContainText('Share');
  });

  test('should display current user as owner', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);
    
    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    // Open share modal
    await page.locator('.share-button').first().click();
    
    // Verify owner badge is displayed
    await expect(page.locator('.collaborator-badge.owner')).toBeVisible();
    await expect(page.locator('.collaborator-badge.owner')).toContainText('Owner');
  });

  test('should add user with edit permission', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);
    
    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    // Open share modal
    await page.locator('.share-button').first().click();
    
    // Add a user with edit permission
    await page.fill('.share-modal-add-user input', 'test-user-123');
    await page.selectOption('.share-modal-add-user select', 'edit');
    await page.click('.share-modal-add-user button:has-text("Add")');
    
    // Wait for success message
    await expect(page.locator('.share-modal-success')).toBeVisible();
    await expect(page.locator('.share-modal-success')).toContainText('test-user-123');
  });

  test('should add user with view permission', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);
    
    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    // Open share modal
    await page.locator('.share-button').first().click();
    
    // Add a user with view permission
    await page.fill('.share-modal-add-user input', 'viewer-user-456');
    await page.selectOption('.share-modal-add-user select', 'view');
    await page.click('.share-modal-add-user button:has-text("Add")');
    
    // Wait for success message
    await expect(page.locator('.share-modal-success')).toBeVisible();
    await expect(page.locator('.share-modal-success')).toContainText('viewer-user-456');
  });

  test('should remove user from collaborators', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);
    
    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    // Open share modal
    await page.locator('.share-button').first().click();
    
    // Add a user
    await page.fill('.share-modal-add-user input', 'temp-user-789');
    await page.click('.share-modal-add-user button:has-text("Add")');
    await page.waitForTimeout(500);
    
    // Remove the user
    const removeButton = page.locator('.btn-danger:has-text("Remove")').last();
    await removeButton.click();
    
    // Wait for success message
    await expect(page.locator('.share-modal-success')).toContainText('removed');
  });

  test('should change user permission from view to edit', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);
    
    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');
    
    // Open share modal
    await page.locator('.share-button').first().click();
    
    // Add a user with view permission
    await page.fill('.share-modal-add-user input', 'upgrade-user-101');
    await page.selectOption('.share-modal-add-user select', 'view');
    await page.click('.share-modal-add-user button:has-text("Add")');
    await page.waitForTimeout(500);
    
    // Change to edit permission
    const makeEditorButton = page.locator('.btn-small:has-text("Make editor")').last();
    await makeEditorButton.click();
    
    // Wait for success message
    await expect(page.locator('.share-modal-success')).toContainText('edit');
  });

  test('should close share modal when clicking close button', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);

    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // Open share modal
    await page.locator('.share-button').first().click();
    await expect(page.locator('.share-modal')).toBeVisible();

    // Close modal
    await page.click('.share-modal-close');

    // Verify modal is closed
    await expect(page.locator('.share-modal')).not.toBeVisible();
  });

  test('should show permission badge on home page', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);

    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // Verify owner badge is displayed
    const ownerBadge = page.locator('.permission-badge.owner').first();
    await expect(ownerBadge).toBeVisible();
    await expect(ownerBadge).toContainText('👑');
  });

  test('should only show delete button for owned documents', async ({ page }) => {
    // Create a new sheet
    await page.click('text=New Sheet');
    await page.waitForTimeout(1000);

    // Go back to home
    await page.goto('http://localhost:5174');
    await page.waitForLoadState('networkidle');

    // Verify delete button is visible for owned document
    const deleteButton = page.locator('.home_sheet_item').first().locator('button:has-text("Delete")');
    await expect(deleteButton).toBeVisible();
  });
});

test.describe('Real-time Collaboration', () => {
  test('should show active users in document', async () => {
    // Create two browser contexts to simulate two users
    const browser = await chromium.launch();
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1: Create a new sheet
      await page1.goto('http://localhost:5174');
      await page1.click('text=New Sheet');
      await page1.waitForTimeout(1000);

      // Get the session ID from URL
      const url1 = page1.url();
      const sessionId = url1.split('/').pop();

      // User 2: Open the same sheet
      await page2.goto(`http://localhost:5174/sheets?session=${sessionId}`);
      await page2.waitForTimeout(2000);

      // Verify active users component is visible on both pages
      await expect(page1.locator('.active-users')).toBeVisible({ timeout: 10000 });
      await expect(page2.locator('.active-users')).toBeVisible({ timeout: 10000 });

      // Verify at least one other user is shown
      const activeUserCount1 = await page1.locator('.active-user-avatar').count();
      const activeUserCount2 = await page2.locator('.active-user-avatar').count();

      expect(activeUserCount1).toBeGreaterThan(0);
      expect(activeUserCount2).toBeGreaterThan(0);
    } finally {
      await context1.close();
      await context2.close();
      await browser.close();
    }
  });

  test('should synchronize cursor positions', async () => {
    const browser = await chromium.launch();
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1: Create a new sheet
      await page1.goto('http://localhost:5174');
      await page1.click('text=New Sheet');
      await page1.waitForTimeout(1000);

      // Get the session ID
      const url1 = page1.url();
      const sessionId = url1.split('/').pop();

      // User 2: Open the same sheet
      await page2.goto(`http://localhost:5174/sheets?session=${sessionId}`);
      await page2.waitForTimeout(2000);

      // User 1: Move cursor to a cell
      await page1.click('[data-row="0"][data-col="0"]');
      await page1.waitForTimeout(1000);

      // User 2: Check if remote cursor is visible
      await expect(page2.locator('.remote-cursor')).toBeVisible({ timeout: 10000 });
    } finally {
      await context1.close();
      await context2.close();
      await browser.close();
    }
  });

  test('should update content in real-time', async () => {
    const browser = await chromium.launch();
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1: Create a new note
      await page1.goto('http://localhost:5174');
      await page1.click('text=New Note');
      await page1.waitForTimeout(1000);

      // Get the session ID
      const url1 = page1.url();
      const sessionId = url1.split('/').pop();

      // User 2: Open the same note
      await page2.goto(`http://localhost:5174/notes?session=${sessionId}`);
      await page2.waitForTimeout(2000);

      // User 1: Type some text
      const testText = 'Hello from User 1!';
      await page1.click('.ql-editor');
      await page1.keyboard.type(testText);
      await page1.waitForTimeout(2000);

      // User 2: Verify the text appears
      const content = await page2.locator('.ql-editor').textContent();
      expect(content).toContain(testText);
    } finally {
      await context1.close();
      await context2.close();
      await browser.close();
    }
  });
});


