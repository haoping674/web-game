from pathlib import Path
import os
from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("WEB_GAME_URL", "http://127.0.0.1:5173")
OUTPUT = Path(__file__).resolve().parents[1] / "reports" / "balance" / "ui-mobile-interactions.png"


def dispatch_touch(session, event_type, points):
    session.send("Input.dispatchTouchEvent", {"type": event_type, "touchPoints": points})


def start_game(page):
    page.locator(".start-screen .primary-button").click()
    tutorial = page.locator('[role="dialog"][aria-label="新手教學"]')
    if tutorial.count():
        tutorial.get_by_role("button", name="跳過").click()
    page.locator('[role="grid"][aria-label="水果數字棋盤"]').wait_for(state="visible")


with sync_playwright() as playwright:
    chrome = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    browser = playwright.chromium.launch(headless=True, executable_path=str(chrome) if chrome.exists() else None)

    context = browser.new_context(viewport={"width": 390, "height": 844}, screen={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    page = context.new_page()
    page.set_default_timeout(6_000)
    console_errors = []
    page_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.reload(wait_until="networkidle")
    start_game(page)

    gesture_hint = page.get_by_text("棋盤內單指框選，雙指可移動畫面。")
    gesture_hint.wait_for(state="visible")
    assert page.evaluate("JSON.parse(localStorage.getItem('orchard-ten-v2')).mobileGestureHintSeen") is True

    layout = page.evaluate(
        """
        () => {
          const board = document.querySelector('.game-board').getBoundingClientRect()
          const style = getComputedStyle(document.querySelector('.game-board'))
          return {
            board: { left: board.left, right: board.right, top: board.top, bottom: board.bottom },
            viewport: { width: innerWidth, height: innerHeight },
            touchAction: style.touchAction,
            userSelect: style.userSelect,
            bodyTouchAction: getComputedStyle(document.body).touchAction,
            footerCount: document.querySelectorAll('.site-footer').length,
            scrollHeight: document.documentElement.scrollHeight,
          }
        }
        """
    )
    assert layout["board"]["left"] >= 12
    assert layout["board"]["right"] <= layout["viewport"]["width"] - 12
    assert layout["board"]["bottom"] <= layout["viewport"]["height"] - 16
    assert "pan" in layout["touchAction"] and "pinch-zoom" in layout["touchAction"]
    assert layout["userSelect"] == "none"
    assert layout["bodyTouchAction"] == "auto"
    assert layout["footerCount"] == 0
    assert layout["scrollHeight"] <= layout["viewport"]["height"] + 2

    session = context.new_cdp_session(page)
    page.locator(".board-actions button").click()
    hint_box = page.locator(".selection-overlay.is-hint").bounding_box()
    assert hint_box
    score_before = int(page.locator(".hud>div:first-child strong").inner_text())
    scroll_before = page.evaluate("scrollY")
    start = {"x": hint_box["x"] + 3, "y": hint_box["y"] + 3, "id": 21, "radiusX": 5, "radiusY": 5, "force": 1}
    end = {"x": hint_box["x"] + hint_box["width"] - 3, "y": hint_box["y"] + hint_box["height"] - 3, "id": 21, "radiusX": 5, "radiusY": 5, "force": 1}
    dispatch_touch(session, "touchStart", [start])
    dispatch_touch(session, "touchMove", [{**start, "x": (start["x"] + end["x"]) / 2, "y": (start["y"] + end["y"]) / 2}])
    dispatch_touch(session, "touchMove", [end])
    dispatch_touch(session, "touchEnd", [])
    page.wait_for_function("before => Number(document.querySelector('.hud>div:first-child strong').textContent) > before", score_before)
    assert page.evaluate("scrollY") == scroll_before

    page.evaluate(
        """
        window.pointerDefaults = []
        window.addEventListener('pointerdown', event => window.pointerDefaults.push({ id: event.pointerId, prevented: event.defaultPrevented }))
        """
    )
    board_box = page.locator(".game-board").bounding_box()
    assert board_box
    first = {"x": board_box["x"] + 20, "y": board_box["y"] + 20, "id": 31, "radiusX": 5, "radiusY": 5, "force": 1}
    second = {"x": board_box["x"] + 55, "y": board_box["y"] + 40, "id": 32, "radiusX": 5, "radiusY": 5, "force": 1}
    score_before_multi = int(page.locator(".hud>div:first-child strong").inner_text())
    dispatch_touch(session, "touchStart", [first])
    page.locator(".selection-overlay").wait_for(state="visible")
    dispatch_touch(session, "touchStart", [first, second])
    page.wait_for_function("document.querySelector('.game-board').dataset.multiPointerBlocked === 'true'")
    assert page.locator(".selection-overlay").count() == 0
    dispatch_touch(session, "touchMove", [{**first, "y": first["y"] - 24}, {**second, "y": second["y"] - 24}])
    dispatch_touch(session, "touchEnd", [])
    page.wait_for_function("!document.querySelector('.game-board').dataset.multiPointerBlocked")
    assert int(page.locator(".hud>div:first-child strong").inner_text()) == score_before_multi
    defaults = page.evaluate("window.pointerDefaults")
    assert defaults[-1]["prevented"] is False

    page.screenshot(path=str(OUTPUT), full_page=True)
    page.reload(wait_until="networkidle")
    start_game(page)
    assert page.get_by_text("棋盤內單指框選，雙指可移動畫面。").count() == 0
    context.close()

    scroll_context = browser.new_context(viewport={"width": 390, "height": 430}, screen={"width": 390, "height": 430}, is_mobile=True, has_touch=True)
    scroll_page = scroll_context.new_page()
    scroll_page.goto(BASE_URL, wait_until="networkidle")
    assert scroll_page.evaluate("document.documentElement.scrollHeight > innerHeight")
    scroll_session = scroll_context.new_cdp_session(scroll_page)
    outside_start = {"x": 376, "y": 390, "id": 41, "radiusX": 5, "radiusY": 5, "force": 1}
    dispatch_touch(scroll_session, "touchStart", [outside_start])
    for y in (320, 250, 180, 110):
        dispatch_touch(scroll_session, "touchMove", [{**outside_start, "y": y}])
    dispatch_touch(scroll_session, "touchEnd", [])
    scroll_page.wait_for_timeout(250)
    assert scroll_page.evaluate("scrollY") > 0
    scroll_context.close()

    assert not console_errors, console_errors
    assert not page_errors, page_errors
    browser.close()

print("Mobile pointer, two-finger cancellation, safe-area, focus layout, one-time hint, and outside scrolling checks passed.")
