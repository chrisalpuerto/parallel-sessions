import asyncio
import json
import os
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from playwright.async_api import async_playwright
import aiohttp

app = FastAPI()
from dotenv import load_dotenv
load_dotenv()

# global state managers
TARGET_SITE_URL = os.getenv("TARGET_SITE_URL")

PROXY_FILE = os.getenv("PROXIES_LIST1")
with open(PROXY_FILE) as f:
    PROXIES = json.load(f)

PROXY_USERNAME = os.getenv("PROXY_USERNAME")
PROXY_PASSWORD = os.getenv("PROXY_PASSWORD")

CAPSOLVER_API_KEY = os.getenv("CAPSOLVER_API_KEY")
TARGET_CAPTCHA_SITE_KEY = os.getenv("TARGET_CAPTCHA_SITE_KEY")

session_states = {}
session_events = {}
session_commands = {}
session_proxies = {}  # populated at start time

def initialize_sessions(n: int):
    session_states.clear()
    session_events.clear()
    session_commands.clear()
    session_proxies.clear()
    for i in range(1, n + 1):
        session_states[i] = {
            "instance": i,
            "ip": "Local",
            "status": "not_started",
            "action": "Idle",
            "email": f"test{i}@example.com",
            "option": "automatic"
        }
        session_events[i] = asyncio.Event()
        session_commands[i] = "auto"
        session_proxies[i] = None
# Store connected UI clients
connected_clients = []

async def solve_captcha_api(website_url: str, site_key: str = TARGET_CAPTCHA_SITE_KEY, captcha_type: str = "ReCaptchaV2TaskProxyLess") -> str:
    """
    Sends the site_key to CapSolver and polls for the solved cryptographic token.
    """
    api_base = "https://api.capsolver.com"
    
    async with aiohttp.ClientSession() as session:
        # 1. Create the solving task
        create_payload = {
            "clientKey": CAPSOLVER_API_KEY,
            "task": {
                "type": captcha_type,
                "websiteURL": website_url,
                "websiteKey": site_key
            }
        }
        
        async with session.post(f"{api_base}/createTask", json=create_payload) as resp:
            create_data = await resp.json()
            if create_data.get("errorId") != 0:
                raise Exception(f"CapSolver Error: {create_data.get('errorDescription')}")
                
            task_id = create_data["taskId"]
            print(f"[*] CapSolver Task Created: {task_id}")

        # 2. Poll for the result (Check every 2 seconds)
        result_payload = {
            "clientKey": CAPSOLVER_API_KEY,
            "taskId": task_id
        }
        
        # Max 120 polling attempts (which is way more than enough for AI solvers)
        for _ in range(120):
            await asyncio.sleep(2)
            async with session.post(f"{api_base}/getTaskResult", json=result_payload) as resp:
                result_data = await resp.json()
                
                if result_data.get("status") == "ready":
                    # For reCAPTCHA, the token is in gRecaptchaResponse. For Turnstile, it's just 'token'
                    solution = result_data.get("solution", {})
                    return solution.get("gRecaptchaResponse") or solution.get("token")
                    
                elif result_data.get("status") == "failed":
                    raise Exception(f"Task Failed: {result_data.get('errorDescription')}")
        
        raise Exception("CapSolver timed out waiting for solution.")

async def broadcast_state():
    # pushes the current session states to all connected clients
    for client in connected_clients:
        try:
            await client.send_json(session_states)
        except Exception:
            pass

async def run_bot(session_id: int, is_visible: bool, target_url: str = TARGET_SITE_URL, proxy: dict = None):
    #playwright bot logic
    proxy_config = {
        "server": f"http://{proxy['entryPoint']}:{proxy['port']}",
        "username": PROXY_USERNAME,
        "password": PROXY_PASSWORD,
    } if proxy else None
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not is_visible)
        context = await browser.new_context(proxy=proxy_config)
        page = await context.new_page()
        is_solving_captcha = False

        async def captcha_watchdog():
            nonlocal is_solving_captcha
            captcha_selector = ".g-recaptcha, iframe[src*='recaptcha'], .cf-turnstile"

            while True:
                try:
                    # Check if a CAPTCHA is visible and we aren't already solving one
                    if not is_solving_captcha and await page.locator(captcha_selector).is_visible():
                        is_solving_captcha = True
                        print(f"[Bot {session_id}] 🚨 Dynamic CAPTCHA detected by Watchdog!")
                        session_states[session_id]["action"] = "Solving Dynamic CAPTCHA..."
                        await broadcast_state()

                        # Trigger solver
                        token = await solve_captcha_api(website_url=page.url, site_key=TARGET_CAPTCHA_SITE_KEY)

                        # Inject Token
                        await page.evaluate(f"document.getElementById('g-recaptcha-response').value = '{token}';")
                        print(f"[Bot {session_id}] Dynamic CAPTCHA solved and injected.")

                        # Small sleep to let the site process the injection
                        await asyncio.sleep(2)
                        is_solving_captcha = False

                    # Poll every 500ms to keep CPU usage low but response time high
                    await asyncio.sleep(0.5)
                except Exception:
                    # If the page closes or crashes, kill the watchdog
                    break

        # Start the watchdog in the background
        watchdog_task = asyncio.create_task(captcha_watchdog())
        try:
            session_states[session_id]["status"] = "running"
            session_states[session_id]["action"] = "Entering Queue"
            await broadcast_state()

            # 1. ENTER THE QUEUE
            await page.goto(target_url)

            # 2. WAIT FOR THE QUEUE TO PASS
            print(f"[Bot {session_id}] On standby page. Waiting for ticket selection...")
            session_states[session_id]["action"] = "In Queue"
            await broadcast_state()

            ga_row = page.locator('.event-details').filter(has_text="3-Day GA")
            await ga_row.wait_for(state="visible", timeout=0)

            # 3. CHECK AVAILABILITY AND SELECT (With 3 Retries)
            print(f"[Bot {session_id}] Queue passed! Checking for GA ticket availability...")
            max_retries = 3
            tickets_secured = False

            for attempt in range(max_retries):
                select_tickets_link = ga_row.locator('a', has_text="Select Tickets")

                if await select_tickets_link.is_visible():
                    print(f"[Bot {session_id}] Tickets found on attempt {attempt + 1}! Clicking...")
                    session_states[session_id]["action"] = "Selecting Tickets"
                    await broadcast_state()
                    await select_tickets_link.click()
                    tickets_secured = True
                    break # passed first screen
                else:
                    print(f"[Bot {session_id}] Attempt {attempt + 1}: SOLD OUT. Refreshing...")
                    session_states[session_id]["action"] = "Sold Out, Retrying"
                    await broadcast_state()
                    if attempt < max_retries - 1:
                        await asyncio.sleep(1)
                        await page.reload()
                        await ga_row.wait_for(state="visible", timeout=0)

            # KILL SWITCH
            if not tickets_secured:
                print(f"[Bot {session_id}] 3rd attempt failed. Completely Sold Out. Killing bot.")
                session_states[session_id]["status"] = "sold_out"
                session_states[session_id]["action"] = "Sold Out"
                await broadcast_state()
                return

            # passcord fork
            # (Now that clicked "Select Tickets", we look for the next popup)
            print(f"[Bot {session_id}] Waiting for the next screen (Passcode or Quantity)...")
            session_states[session_id]["action"] = "Waiting for Screen"
            await broadcast_state()
            passcode_label = page.locator('text="ENTER CODE:"')

            button_by_class = page.locator('button.fbtn-quantity-up')
            button_by_role = page.get_by_role("button", name="Increase Quantity")
            plus_button = button_by_class.or_(button_by_role)

            # Race them
            await passcode_label.or_(plus_button).wait_for(state="visible")

            # Handle the passcode if it appeared
            if await passcode_label.is_visible():
                price_visible = await page.locator('text="Price"').is_visible()
                if price_visible:
                    # Check for sold out on price screen, retry up to 3 times
                    price_sold_out_retries = 3
                    for price_attempt in range(1, price_sold_out_retries + 1):
                        sold_out = await page.locator('text="SOLD OUT"').is_visible()
                        if not sold_out:
                            break
                        if price_attempt < price_sold_out_retries:
                            print(f"[Bot {session_id}] Sold out on price screen, retry {price_attempt}/{price_sold_out_retries}...")
                            session_states[session_id]["action"] = f"Sold Out, retry {price_attempt}/{price_sold_out_retries}"
                            await broadcast_state()
                            await page.reload()
                            await passcode_label.or_(plus_button).wait_for(state="visible")
                        else:
                            print(f"[Bot {session_id}] Sold out after {price_sold_out_retries} retries. Killing bot.")
                            session_states[session_id]["status"] = "sold_out"
                            session_states[session_id]["action"] = "Sold Out"
                            await broadcast_state()
                            return
                    print(f"[Bot {session_id}] Price screen ready — proceeding to cart.")
                    session_states[session_id]["action"] = "Add Cart Attempt"
                    await broadcast_state()
                else:
                    print(f"[Bot {session_id}] Passcode wall detected! Injecting code...")
                    session_states[session_id]["action"] = "Entering Passcode"
                    await broadcast_state()
                    passcode_input = page.get_by_role("textbox")
                    await passcode_input.fill("NHNH26")

                    await page.locator('button', has_text="Go").click()
                    print(f"[Bot {session_id}] Code submitted. Moving on...")

            # 4+5+6. SELECT AMOUNT → ADD TO CART → WAIT FOR CHECKOUT (with retry on cart failure)
            cart_max_retries = 3
            cart_secured = False
            sold_out_hit = False
            sold_out_locator = page.locator('text="SOLD OUT"')

            for cart_attempt in range(1, cart_max_retries + 1):
                print(f"[Bot {session_id}] Adjusting ticket quantity...")
                session_states[session_id]["action"] = "Selecting Quantity"
                await broadcast_state()

                # Race plus_button visibility against SOLD OUT before adjusting quantity
                await plus_button.or_(sold_out_locator).wait_for(state="visible")
                if await sold_out_locator.is_visible():
                    print(f"[Bot {session_id}] SOLD OUT - attempt {cart_attempt}/{cart_max_retries}")
                    session_states[session_id]["action"] = f"Sold Out - Retry {cart_attempt}/{cart_max_retries}"
                    await broadcast_state()
                    sold_out_hit = True
                    if cart_attempt < cart_max_retries:
                        await asyncio.sleep(2)
                        await page.reload()
                    continue
                await plus_button.click()

                print(f"[Bot {session_id}] Clicking Add to Cart...")
                session_states[session_id]["action"] = "Add Cart Attempt"
                await broadcast_state()
                add_to_cart_btn = page.locator('button', has_text="Add to Cart")
                await add_to_cart_btn.click()

                print(f"[Bot {session_id}] Cart submitted. Waiting for result...")
                session_states[session_id]["action"] = "Searching for Tickets..."
                await broadcast_state()

                success_text = page.locator('text="Success!"')
                checkout_btn = page.locator('a, button').filter(has_text="Checkout")
                unable_locator = page.locator('text="Unable to cart"')
                unavailable_locator = page.locator('text="unavailable"')
                await success_text.or_(checkout_btn).or_(unable_locator).or_(unavailable_locator).or_(sold_out_locator).wait_for(state="visible", timeout=15000)

                if await sold_out_locator.is_visible():
                    print(f"[Bot {session_id}] SOLD OUT after Add to Cart - attempt {cart_attempt}/{cart_max_retries}")
                    session_states[session_id]["action"] = f"Sold Out - Retry {cart_attempt}/{cart_max_retries}"
                    await broadcast_state()
                    sold_out_hit = True
                    if cart_attempt < cart_max_retries:
                        await asyncio.sleep(2)
                        await page.reload()
                    continue

                if await success_text.is_visible() or await checkout_btn.is_visible():
                    cart_secured = True
                    break

                print(f"[Bot {session_id}] Cart failed on attempt {cart_attempt}.")
                if cart_attempt < cart_max_retries:
                    session_states[session_id]["action"] = f"Failed Cart, Retry {cart_attempt}/{cart_max_retries}"
                    await broadcast_state()
                    await page.reload()
                    await plus_button.wait_for(state="visible", timeout=10000)

            if not cart_secured:
                if sold_out_hit:
                    session_states[session_id]["status"] = "sold_out"
                    session_states[session_id]["action"] = "Sold Out"
                else:
                    session_states[session_id]["status"] = "failed"
                    session_states[session_id]["action"] = "Failed"
                await broadcast_state()
                return

            # Click Checkout to proceed
            print(f"[Bot {session_id}] Cart secured! Clicking Checkout...")
            session_states[session_id]["action"] = "Clicking Checkout"
            await broadcast_state()
            await checkout_btn.click()

            # Check if a login screen appeared
            if await page.locator('input[name="email"]').is_visible():
                print(f"[Bot {session_id}] Login required. Pausing for UI input...")
                session_states[session_id]["status"] = "login_required"
                session_states[session_id]["action"] = "Waiting for Credentials"
                await broadcast_state()

                session_events[session_id].clear()
                await session_events[session_id].wait()

                credentials = session_commands[session_id]
                email = credentials.get("email")
                password = credentials.get("password")

                await page.locator('input[name="email"]').fill(email)
                await page.locator('input[name="password"]').fill(password)
                await page.locator('button', has_text="Login").click()

                print(f"[Bot {session_id}] Credentials injected. Resuming...")

            session_states[session_id]["status"] = "finished"
            session_states[session_id]["action"] = "Checkout Reached!"
            print(f"[Bot {session_id}] Checkout reached!")

        except Exception as e:
            session_states[session_id]["status"] = "failed"
            session_states[session_id]["action"] = "Failed"
            print(f"[Bot {session_id}] Failed: {str(e)}")
        finally:
            watchdog_task.cancel()
            await broadcast_state()
            await context.close()
            await browser.close()