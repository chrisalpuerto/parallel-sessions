import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from playwright.async_api import async_playwright

app = FastAPI()
import os
from dotenv import load_dotenv
load_dotenv()


# global state managers
TARGET_SITE_URL = os.getenv("TARGET_SITE_URL")

session_states = {
    i: {
        "instance": i,
        "ip": "Local", # inject proxy IPs here, for now using local
        "status": "not_started", 
        "email": f"test{i}@example.com", # Generate or assign emails here
        "option": "automatic" # Default option
    } for i in range(1, 6)
}
session_events = {i: asyncio.Event() for i in range(1, 6)}
session_commands = {i: "auto" for i in range(1, 6)} 
# Store connected UI clients
connected_clients = []

async def broadcast_state():
    # pushes the current session states to all connected clients
    for client in connected_clients:
        try:
            await client.send_json(session_states)
        except Exception:
            pass

async def run_bot(session_id: int, is_visible: bool, target_url: str = TARGET_SITE_URL):
    #playwright bot logic
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not is_visible)
        context = await browser.new_context()
        page = await context.new_page()
        try:
            # enter queue
            session_states[session_id]["status"] = "running"
            await broadcast_state()
            # URL input
            await page.goto(target_url)
            # Simulate waiting in a queue (normally you'd wait for a selector here)
            await asyncio.sleep(3)
            # 2. queue passed, now waiting for UI input
            session_states[session_id]["status"] = "awaiting_orders"
            await broadcast_state()
            print(f"[Bot {session_id}] Passed queue. Waiting for you to click a button in UI...")
            await session_events[session_id].wait()

            # 3. got command from UI, execute it
            command = session_commands[session_id]
            session_states[session_id]["option"] = command
            await broadcast_state()

            if command == "manual":
                session_states[session_id]["status"] = "manual_takeover"
                await broadcast_state()
                print(f"[Bot {session_id}] Handing over to you. Use the browser window.")
                # Playwright pauses, allowing you to physically click around
                await page.pause()

            elif command == "auto":
                session_states[session_id]["status"] = "running_auto"
                await broadcast_state()
                print(f"[Bot {session_id}] Executing automated payload...")
                # Put your automated typing/clicking here
                await asyncio.sleep(2) # Simulating work

            session_states[session_id]["status"] = "finished"

        except Exception:
            session_states[session_id]["status"] = "error"
        finally:
            await broadcast_state()
            await context.close()
            await browser.close()