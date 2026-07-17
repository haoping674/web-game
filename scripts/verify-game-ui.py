from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reports" / "balance"
BASE_URL = os.environ.get("WEB_GAME_URL", "http://127.0.0.1:5173")
OUTPUT.mkdir(parents=True, exist_ok=True)


def verify_page(browser, viewport, screenshot_name):
    context = browser.new_context(viewport=viewport)
    page = context.new_page()
    page.set_default_timeout(5_000)
    console_errors = []
    page_errors = []
    failed_requests = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("requestfailed", lambda request: failed_requests.append(f"{request.method} {request.url}: {request.failure}"))

    page.goto(BASE_URL, wait_until="networkidle")
    if page.locator(".start-screen .primary-button").count() == 0:
        print({"url": page.url, "title": page.title(), "body": page.locator("body").inner_text()[:500], "console": console_errors, "page_errors": page_errors, "failed_requests": failed_requests})
    page.locator(".start-screen .primary-button").click()
    if page.locator('[role="dialog"][aria-label="新手教學"]').count():
        page.locator('[role="dialog"][aria-label="新手教學"] .text-button').click()
    board = page.locator('[role="grid"]')
    board.wait_for(state="visible")
    assert page.locator(".fruit-cell").count() == 170

    page.locator(".board-actions button").filter(has_text="提示").click()
    page.locator(".selection-overlay.is-hint").wait_for(state="visible")
    assert "提示已顯示" in page.locator(".selection-status").inner_text()

    assert page.locator(".board-actions button").filter(has_text="主動重排").count() == 0
    assert page.locator(".fruit-cell").count() == 170

    page.screenshot(path=str(OUTPUT / screenshot_name), full_page=True)
    context.close()
    return console_errors, page_errors, failed_requests


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    )
    desktop = verify_page(browser, {"width": 1440, "height": 1000}, "ui-desktop.png")
    mobile = verify_page(browser, {"width": 390, "height": 844}, "ui-mobile.png")
    browser.close()

errors = {
    "console": desktop[0] + mobile[0],
    "page": desktop[1] + mobile[1],
    "requests": desktop[2] + mobile[2],
}
assert not errors["console"], errors
assert not errors["page"], errors
assert not errors["requests"], errors
print("Desktop and mobile UI verification passed with no console, page, or request errors.")
