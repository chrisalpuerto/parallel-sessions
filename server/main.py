from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect)
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from async_functions import run_bot, session_states, session_events, session_commands, connected_clients, broadcast_state
import asyncio
import os
from dotenv import load_dotenv
from playwright.async_api import async_playwright
load_dotenv()


app = FastAPI()
TARGET_SITE_URL = os.getenv("TARGET_SITE_URL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# server running on port 8000

@app.get("/")
def check_server():
    return {"message": "Server is up and running"}

class StartTestRequest(BaseModel):
    target_url: str

active_tasks = {}

@app.post("/start-test")
async def start_test(body: StartTestRequest):
    """Endpoint to trigger the 5 bots from your UI."""
    target_url = body.target_url or TARGET_SITE_URL

    # Reset states and events for a fresh run
    for i in range(1, 6):
        session_states[i]["status"] = "starting"
        session_events[i].clear()
    await broadcast_state()

    # concurrent background tasks for all 5 bots
    for i in range(1, 6):
        # Make ONLY Session 1 visible for manual testing
        is_visible = (i == 1)
        task = asyncio.create_task(run_bot(i, is_visible, target_url=target_url))
        active_tasks[i] = task

    return {"message": "5 Sessions Launched"}

@app.post("/stop-test")
async def stop_test():
    """Endpoint to forcefully stop all running bots."""
    killed_count = 0
    
    for session_id, task in active_tasks.items():
        # Check if the task is actually running before trying to kill it
        if task and not task.done():
            task.cancel() 
            killed_count += 1
            
    return {"message": f"Sent kill signal to {killed_count} active bots"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    #handles the real-time connection for React
    await websocket.accept()
    connected_clients.append(websocket)
    
    # Send initial state immediately upon connection
    await websocket.send_json(session_states)
    
    try:
        while True:
            # Listen for button clicks from React 
            # Expected format: {"session_id": 1, "command": "manual"}
            data = await websocket.receive_json()
            session_id = int(data.get("session_id"))
            command = data.get("command")
            
            if session_id in session_events:
                # Save the choice ("auto" or "manual")
                session_commands[session_id] = command
                # Turn the traffic light green so the bot unfreezes!
                session_events[session_id].set()
                
    except WebSocketDisconnect:
        connected_clients.remove(websocket)

@app.get("/sessions")
def get_sessions():
    return list(session_states.values())
