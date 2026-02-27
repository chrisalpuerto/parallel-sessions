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

            ga_row = page.locator('.event-details').filter(has_text="2-Day GA")
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
                    await passcode_input.fill("Allgas")

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
                await page.locator('button', has_text="Log in").click()

                print(f"[Bot {session_id}] Credentials injected. Resuming...")

            # Wait for page to settle after login
            await page.wait_for_load_state("domcontentloaded", timeout=15000)

            # ── STEP: Delivery option dropdown (auto, no UI pause) ──────────────
            # If the select still shows a "Please Select" placeholder, pick index 1
            delivery_select = page.locator("select").first
            try:
                first_option_text = await delivery_select.locator("option").first.inner_text(timeout=3000)
                if "Please Select" in first_option_text:
                    selected_val = await delivery_select.input_value()
                    if not selected_val:
                        await delivery_select.select_option(index=1)
                        print(f"[Bot {session_id}] Delivery option selected.")
                        session_states[session_id]["action"] = "Delivery Option Selected"
                        await broadcast_state()
            except Exception:
                pass  # No delivery dropdown present — skip

            # ── STEP: Shipping Address form ─────────────────────────────────────
            shipping_first_name = page.locator(
                'input[placeholder*="First Name"], input[name*="firstName"]'
            ).first
            try:
                await shipping_first_name.wait_for(state="visible", timeout=5000)
                shipping_visible = True
            except Exception:
                shipping_visible = False

            if shipping_visible:
                print(f"[Bot {session_id}] Shipping address required. Pausing for UI input...")
                session_states[session_id]["status"] = "shipping_required"
                session_states[session_id]["action"] = "Waiting for Shipping Address"
                await broadcast_state()

                session_events[session_id].clear()
                await session_events[session_id].wait()

                sh = session_commands[session_id]

                await page.locator(
                    'input[placeholder*="First Name"], input[name*="firstName"]'
                ).first.fill(sh.get("firstName", ""))
                await page.locator(
                    'input[placeholder*="Last Name"], input[name*="lastName"]'
                ).first.fill(sh.get("lastName", ""))

                # Address — Google Places autocomplete: type → wait → ArrowDown → Enter
                addr_input = page.locator(
                    '[placeholder*="Select Address"], input[name*="address"]'
                ).first
                await addr_input.fill(sh.get("address", ""))
                await asyncio.sleep(1.5)
                await addr_input.press("ArrowDown")
                await addr_input.press("Enter")
                await asyncio.sleep(0.5)

                # Apartment (optional)
                apt_input = page.locator(
                    'input[placeholder*="Apartment"], input[name*="apartment"], input[name*="unit"]'
                ).first
                try:
                    if await apt_input.is_visible(timeout=1000) and sh.get("apartment"):
                        await apt_input.fill(sh.get("apartment", ""))
                except Exception:
                    pass

                # City
                await page.locator(
                    'input[placeholder*="City"], input[name*="city"]'
                ).first.fill(sh.get("city", ""))

                # State — select dropdown
                state_select = page.locator('select[name*="state"], select[id*="state"]').first
                try:
                    await state_select.select_option(label=sh.get("state", "California"))
                except Exception:
                    try:
                        await state_select.select_option(value=sh.get("stateCode", "CA"))
                    except Exception:
                        pass

                # Zip
                await page.locator(
                    'input[placeholder*="Zip"], input[name*="zip"], input[name*="postal"]'
                ).first.fill(sh.get("zip", ""))

                # Click Next
                await page.locator('button', has_text="Next").first.click()
                print(f"[Bot {session_id}] Shipping address submitted. Resuming...")
                session_states[session_id]["action"] = "Shipping Submitted"
                await broadcast_state()
                await page.wait_for_load_state("domcontentloaded", timeout=15000)

            # ── STEP: Payment — Credit Card + card details form ─────────────────
            credit_card_btn = page.locator('button', has_text="Credit Card")
            try:
                await credit_card_btn.wait_for(state="visible", timeout=10000)
                await credit_card_btn.click()
                print(f"[Bot {session_id}] Credit Card selected.")
                session_states[session_id]["action"] = "Credit Card Clicked"
                await broadcast_state()
                await asyncio.sleep(1)
            except Exception:
                pass

            # Check for "Use a different card" (saved card on file)
            use_diff_btn = page.locator('button', has_text="Use a different card")
            card_form_needed = True
            try:
                if await use_diff_btn.is_visible(timeout=3000):
                    await use_diff_btn.click()
                    print(f"[Bot {session_id}] 'Use a different card' clicked.")
                    session_states[session_id]["action"] = "Using Different Card"
                    await broadcast_state()
                    await asyncio.sleep(1)
                    card_form_needed = False
            except Exception:
                pass

            if card_form_needed:
                card_number_input = page.locator(
                    'input[name*="cardNumber"], input[name*="card_number"], input[placeholder*="Card Number"]'
                ).first
                try:
                    await card_number_input.wait_for(state="visible", timeout=5000)
                    card_visible = True
                except Exception:
                    card_visible = False

                if card_visible:
                    print(f"[Bot {session_id}] Card details required. Pausing for UI input...")
                    session_states[session_id]["status"] = "card_required"
                    session_states[session_id]["action"] = "Waiting for Card Details"
                    await broadcast_state()

                    session_events[session_id].clear()
                    await session_events[session_id].wait()

                    cd = session_commands[session_id]

                    # Card holder name — scoped to "Card Details" section
                    try:
                        card_section = page.locator('text="Card Details"').locator('..')
                        await card_section.locator(
                            'input[name*="firstName"], input[placeholder*="First Name"]'
                        ).first.fill(cd.get("firstName", ""))
                        await card_section.locator(
                            'input[name*="lastName"], input[placeholder*="Last Name"]'
                        ).first.fill(cd.get("lastName", ""))
                    except Exception:
                        # Fallback: fill second occurrence of name fields
                        await page.locator(
                            'input[name*="firstName"], input[placeholder*="First Name"]'
                        ).nth(1).fill(cd.get("firstName", ""))
                        await page.locator(
                            'input[name*="lastName"], input[placeholder*="Last Name"]'
                        ).nth(1).fill(cd.get("lastName", ""))

                    # Card number
                    await card_number_input.fill(cd.get("cardNumber", ""))

                    # CVC/CVV
                    await page.locator(
                        'input[name*="cvc"], input[name*="cvv"], input[placeholder*="CVV"], input[placeholder*="CVC"]'
                    ).first.fill(cd.get("cvc", ""))

                    # Month / Year
                    await page.locator(
                        'input[placeholder="MM"], input[name*="month"]'
                    ).first.fill(cd.get("month", ""))
                    await page.locator(
                        'input[placeholder="YYYY"], input[name*="year"]'
                    ).first.fill(cd.get("year", ""))

                    # Contact phone
                    try:
                        phone_input = page.locator('input[name*="phone"], input[type="tel"]').first
                        await phone_input.fill(cd.get("phone", ""))
                    except Exception:
                        pass

                    # Billing address
                    if not cd.get("sameAsShipping", False):
                        await page.locator('input[name*="address"]').nth(1).fill(cd.get("address", ""))
                        try:
                            apt_input2 = page.locator(
                                'input[name*="apartment"], input[name*="unit"]'
                            ).nth(1)
                            if await apt_input2.is_visible(timeout=500) and cd.get("apartment"):
                                await apt_input2.fill(cd.get("apartment", ""))
                        except Exception:
                            pass
                        await page.locator('input[name*="city"]').nth(1).fill(cd.get("city", ""))
                        billing_state = page.locator('select[name*="state"]').nth(1)
                        try:
                            await billing_state.select_option(label=cd.get("state", "California"))
                        except Exception:
                            pass
                        await page.locator(
                            'input[name*="zip"], input[name*="postal"]'
                        ).nth(1).fill(cd.get("zip", ""))
                    else:
                        # Check "Same as my shipping address" checkbox
                        try:
                            same_chk = page.locator('input[type="checkbox"]').filter(has_text="Same as my shipping")
                            if not await same_chk.is_checked():
                                await same_chk.click()
                        except Exception:
                            try:
                                await page.locator('text="Same as my shipping address"').click()
                            except Exception:
                                pass

                    # Click Next
                    await page.locator('button', has_text="Next").first.click()
                    print(f"[Bot {session_id}] Card details submitted. Resuming...")
                    session_states[session_id]["action"] = "Card Submitted"
                    await broadcast_state()

            # ── STEP 3: Ticket Insurance — always decline ────────────────────────
            session_states[session_id]["action"] = "Declining Insurance"
            await broadcast_state()

            no_insurance = page.locator('label, span, div').filter(has_text="No, don't protect")
            try:
                await no_insurance.wait_for(state="visible", timeout=10000)
                await no_insurance.click()
                print(f"[Bot {session_id}] Insurance declined.")
                session_states[session_id]["action"] = "Insurance Declined"
                await broadcast_state()
                await asyncio.sleep(0.5)
                await page.locator('button', has_text="Next").first.click()
                print(f"[Bot {session_id}] Insurance Next clicked.")
                session_states[session_id]["action"] = "Insurance Submitted"
                await broadcast_state()
                await page.wait_for_load_state("domcontentloaded", timeout=15000)
            except Exception as e:
                print(f"[Bot {session_id}] Insurance step skipped/failed: {e}")

            # ── STEP 4: Review & Confirm — email + checkboxes + Purchase Tickets ──
            receipt_email_input = page.locator(
                'input[type="email"], input[placeholder*="email"], input[name*="email"]'
            ).first
            try:
                await receipt_email_input.wait_for(state="visible", timeout=10000)
                review_visible = True
            except Exception:
                review_visible = False

            if review_visible:
                print(f"[Bot {session_id}] Review & Confirm page. Pausing for receipt email...")
                session_states[session_id]["status"] = "receipt_required"
                session_states[session_id]["action"] = "Waiting for Receipt Email"
                await broadcast_state()

                session_events[session_id].clear()
                await session_events[session_id].wait()

                receipt_data = session_commands[session_id]
                receipt_email = receipt_data.get("receiptEmail", "")

                # Fill receipt email
                await receipt_email_input.fill(receipt_email)
                session_states[session_id]["action"] = "Filling Receipt Email"
                await broadcast_state()
                await asyncio.sleep(0.5)

                # Check all unchecked checkboxes on the page
                all_checkboxes = page.locator('input[type="checkbox"]')
                count = await all_checkboxes.count()
                for i in range(count):
                    chk = all_checkboxes.nth(i)
                    try:
                        if await chk.is_visible(timeout=500) and not await chk.is_checked():
                            await chk.click()
                    except Exception:
                        pass
                session_states[session_id]["action"] = "Checkboxes Ticked"
                await broadcast_state()
                await asyncio.sleep(0.5)

                # Click Purchase Tickets
                await page.locator('button', has_text="Purchase Tickets").click()
                print(f"[Bot {session_id}] Purchase Tickets clicked.")
                session_states[session_id]["action"] = "Purchasing..."
                await broadcast_state()

                # Wait for confirmation
                try:
                    thank_you = page.locator('text="Thank you"')
                    await thank_you.wait_for(state="visible", timeout=30000)
                    session_states[session_id]["status"] = "complete"
                    session_states[session_id]["action"] = "COMPLETE!"
                    print(f"[Bot {session_id}] Purchase successful!")
                    await broadcast_state()
                    return
                except Exception:
                    pass  # fall through to finished

            session_states[session_id]["status"] = "finished"
            session_states[session_id]["action"] = "Checkout Reached"
            print(f"[Bot {session_id}] Checkout reached!")
            await broadcast_state()

        except Exception as e:
            session_states[session_id]["status"] = "failed"
            session_states[session_id]["action"] = "Failed"
            print(f"[Bot {session_id}] Failed: {str(e)}")
        finally:
            watchdog_task.cancel()
            await broadcast_state()
            await context.close()
            await browser.close()