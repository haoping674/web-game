from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reports" / "balance"
BASE_URL = os.environ.get("WEB_GAME_URL", "http://127.0.0.1:5173")
OUTPUT.mkdir(parents=True, exist_ok=True)


def verify_page(browser, viewport, screenshot_name, mode_name, expected_seconds):
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
    if screenshot_name == "ui-desktop.png":
        page.screenshot(path=str(OUTPUT / "ui-mode-picker-desktop.png"), full_page=True)
    elif screenshot_name == "ui-mobile.png":
        page.screenshot(path=str(OUTPUT / "ui-mode-picker-mobile.png"), full_page=True)
    mode = page.get_by_role("radio", name=mode_name)
    mode.click()
    assert mode.is_checked()
    page.locator(".start-screen .primary-button").click()
    if page.locator('[role="dialog"][aria-label="新手教學"]').count():
        page.locator('[role="dialog"][aria-label="新手教學"] .text-button').click()
    board = page.locator('[role="grid"]')
    board.wait_for(state="visible")
    assert mode_name in page.locator(".mode-chip").inner_text()
    minutes, seconds = [int(part) for part in page.locator(".timer strong").inner_text().split(":")]
    remaining_seconds = minutes * 60 + seconds
    assert expected_seconds - 5 <= remaining_seconds <= expected_seconds
    assert page.locator(".fruit-cell").count() == 170

    page.locator(".board-actions button").filter(has_text="提示").click()
    page.locator(".selection-overlay.is-hint").wait_for(state="visible")
    assert "提示已顯示" in page.locator(".selection-status").inner_text()

    assert page.locator(".board-actions button").filter(has_text="主動重排").count() == 0
    assert page.locator(".fruit-cell").count() == 170

    page.emulate_media(reduced_motion="reduce")
    page.wait_for_timeout(100)
    page.screenshot(path=str(OUTPUT / screenshot_name), full_page=True)
    context.close()
    return console_errors, page_errors, failed_requests


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    )
    desktop_classic = verify_page(browser, {"width": 1440, "height": 1000}, "ui-desktop.png", "經典", 120)
    desktop_quick = verify_page(browser, {"width": 1440, "height": 1000}, "ui-desktop-quick.png", "快速", 60)
    mobile_hard = verify_page(browser, {"width": 390, "height": 844}, "ui-mobile.png", "困難", 90)
    browser.close()

errors = {
    "console": desktop_classic[0] + desktop_quick[0] + mobile_hard[0],
    "page": desktop_classic[1] + desktop_quick[1] + mobile_hard[1],
    "requests": desktop_classic[2] + desktop_quick[2] + mobile_hard[2],
}
assert not errors["console"], errors
assert not errors["page"], errors
assert not errors["requests"], errors
print("Classic, Quick, and Hard UI verification passed with no console, page, or request errors.")
