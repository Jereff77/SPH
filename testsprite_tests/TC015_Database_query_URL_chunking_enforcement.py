import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5174/", wait_until="commit", timeout=10000)
        
        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass
        
        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass
        
        # Interact with the page elements to simulate user flow
        # -> Input username and password, then click login button to authenticate.
        frame = context.pages[-1]
        # Input username email
        elem = frame.locator('xpath=html/body/div/div/div/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('jereff@aceleremos.com')
        

        frame = context.pages[-1]
        # Input password
        elem = frame.locator('xpath=html/body/div/div/div/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Ma21436587$')
        

        frame = context.pages[-1]
        # Click login button to submit credentials
        elem = frame.locator('xpath=html/body/div/div/div/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Open 'Tipo de QR' searchable select dropdown to choose a QR type.
        frame = context.pages[-1]
        # Click 'Tipo de QR' searchable select trigger to open dropdown
        elem = frame.locator('xpath=html/body/div/div/main/section/div/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select 'Uso General (20 disp. hoy)' option from 'Tipo de QR' dropdown.
        frame = context.pages[-1]
        # Click 'Uso General (20 disp. hoy)' option in 'Tipo de QR' dropdown
        elem = frame.locator('xpath=html/body/div/div/main/section/div/div[2]/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Click 'Visitante' searchable select trigger to open dropdown for visitor selection.
        frame = context.pages[-1]
        # Click 'Visitante' searchable select trigger to open dropdown
        elem = frame.locator('xpath=html/body/div/div/main/section[2]/div[2]/div').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Input a large visitor list or simulate large query by typing a long search string in the 'Visitante' search input to test chunking and query handling.
        frame = context.pages[-1]
        # Input a long visitor list string to simulate large query parameter
        elem = frame.locator('xpath=html/body/div/div/main/section[2]/div[2]/div[2]/div/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('visitor1,visitor2,visitor3,visitor4,visitor5,visitor6,visitor7,visitor8,visitor9,visitor10,visitor11,visitor12,visitor13,visitor14,visitor15,visitor16,visitor17,visitor18,visitor19,visitor20')
        

        # -> Click the 'Generar Acceso QR' button to trigger the query and verify no errors related to URL length or request size occur.
        frame = context.pages[-1]
        # Click 'Generar Acceso QR' button to trigger the query with large visitor list
        elem = frame.locator('xpath=html/body/div/div/main/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=SPH Control de Accesos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Operando como: jereff').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tipo de QR').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Selecciona un tipo...').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Visitante').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Nuevo visitante').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Selecciona un visitante...').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Fecha de Visita').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Generar Acceso QR').first).to_be_visible(timeout=30000)
        await asyncio.sleep(5)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    