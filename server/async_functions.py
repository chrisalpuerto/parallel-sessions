import asyncio
import json
import os
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from playwright.async_api import async_playwright

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

session_states = {
    i: {
        "instance": i,
        "ip": "Local", # inject proxy IPs here, for now using local
        "status": "not_started",
        "action": "Idle",
        "email": f"test{i}@example.com", # Generate or assign emails here
        "option": "automatic" # Default option
    } for i in range(1, 6)
}
session_events = {i: asyncio.Event() for i in range(1, 6)}
session_commands = {i: "auto" for i in range(1, 6)}
session_proxies = {i: None for i in range(1, 6)}  # populated at start time
# Store connected UI clients
connected_clients = []

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

            for cart_attempt in range(1, cart_max_retries + 1):
                print(f"[Bot {session_id}] Adjusting ticket quantity...")
                session_states[session_id]["action"] = "Selecting Quantity"
                await broadcast_state()
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
                await success_text.or_(checkout_btn).or_(unable_locator).or_(unavailable_locator).wait_for(state="visible", timeout=15000)

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
                session_states[session_id]["status"] = "failed"
                session_states[session_id]["action"] = "Failed"
                await broadcast_state()
                return

            session_states[session_id]["status"] = "finished"
            session_states[session_id]["action"] = "Checkout Reached!"
            print(f"[Bot {session_id}] Checkout reached!")

        except Exception as e:
            session_states[session_id]["status"] = "failed"
            session_states[session_id]["action"] = "Failed"
            print(f"[Bot {session_id}] Failed: {str(e)}")
        finally:
            await broadcast_state()
            await context.close()
            await browser.close()