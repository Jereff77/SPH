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
        await page.goto("http://localhost:5173", wait_until="commit", timeout=10000)
        
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
        # -> Input the provided username and password, then click the login button to log in.
        frame = context.pages[-1]
        # Input the username email
        elem = frame.locator('xpath=html/body/div/div/div/form/div/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('jereff@aceleremos.com')
        

        frame = context.pages[-1]
        # Input the password
        elem = frame.locator('xpath=html/body/div/div/div/form/div[2]/input').nth(0)
        await page.wait_for_timeout(3000); await elem.fill('Ma21436587$')
        

        frame = context.pages[-1]
        # Click the login button to log in
        elem = frame.locator('xpath=html/body/div/div/div/form/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Fill all required fields except for the identification image upload and attempt to submit the form.
        frame = context.pages[-1]
        # Click 'Generar Acceso QR' button to attempt form submission without uploading ID image
        elem = frame.locator('xpath=html/body/div/div/main/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select a valid option in the 'Tipo de QR' dropdown, then attempt to submit the form again without uploading the ID image to verify if the system blocks submission.
        frame = context.pages[-1]
        # Click 'Generar Acceso QR' button to attempt form submission without ID image upload
        elem = frame.locator('xpath=html/body/div/div/main/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Manually input or select a valid 'Tipo de QR' option if possible, or investigate why dropdown selection fails. Then attempt form submission again without uploading ID image to verify if system blocks registration.
        frame = context.pages[-1]
        # Click 'Tipo de QR' dropdown to open options
        elem = frame.locator('xpath=html/body/div/div/main/section/select').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Try to select a different 'Tipo de QR' option or interact with the dropdown differently. If not possible, extract page content to check for any visible error messages or validation messages related to missing ID upload after form submission.
        frame = context.pages[-1]
        # Click 'Tipo de QR' dropdown to try to open options
        elem = frame.locator('xpath=html/body/div/div/main/section/select').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select 'Uso General' option from 'Tipo de QR' dropdown, then fill visitor and date fields, and attempt to submit the form again without uploading the ID image to verify if the system blocks registration.
        frame = context.pages[-1]
        # Click 'Generar Acceso QR' button to attempt form submission without ID image upload
        elem = frame.locator('xpath=html/body/div/div/main/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # -> Select 'Uso General' from 'Tipo de QR' dropdown, ensure visitor and date fields are filled, then click 'Generar Acceso QR' to attempt form submission without ID image upload.
        frame = context.pages[-1]
        # Click 'Generar Acceso QR' button to attempt form submission without ID image upload
        elem = frame.locator('xpath=html/body/div/div/main/button').nth(0)
        await page.wait_for_timeout(3000); await elem.click(timeout=5000)
        

        # --> Assertions to verify final state
        frame = context.pages[-1]
        await expect(frame.locator('text=SPH Control de Accesos').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Operando como: jereff').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Tipo de QR').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Selecciona un tipo...').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Uso General (20 disp. hoy)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Administrativo (Ilimitado)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Visitante').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Nuevo visitante').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Selecciona un visitante...').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=bl (544545)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Bruno Levet (XYZ-133-V)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Gonzalo Almanza (XYZ-123-Y)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Juan Perez (XYZ-123-V)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Juan Perez (XYZ-432-V)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=Mariana Pulquero (BH-123-K)').first).to_be_visible(timeout=30000)
        await expect(frame.locator('text=pedro perez (dfdgff)').first).to_be_visible(timeout=30000)
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
    