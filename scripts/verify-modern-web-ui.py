import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports' / 'modern-web'
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.getenv('WEB_GAME_URL', 'http://127.0.0.1:5173')
games = ['length-sense', 'second-sense', 'slide-ten', 'fruit-sum', 'color-links']
routes = ['/', '/en'] + ['/games/' + g for g in games + ['sprout-island', 'ashbound']] + ['/en/games/' + g for g in games]
results = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width in [int(value) for value in os.getenv('WEB_GAME_WIDTHS','1440,390,320').split(',')]:
        context = browser.new_context(viewport={'width':width, 'height':900}, is_mobile=width < 500, has_touch=width < 500, reduced_motion='reduce')
        page = context.new_page()
        device = context.new_cdp_session(page)
        page.route('**/api/leaderboard**', lambda r: r.fulfill(json={'entries':[], 'eligible':False, 'accepted':False, 'rank':None}))
        for route in routes:
            errors = []
            def on_error(error): errors.append(str(error))
            page.on('pageerror', on_error)
            page.goto(BASE + route)
            page.wait_for_load_state('networkidle')
            page.locator('h1').first.wait_for()
            result = page.evaluate('''() => ({title:document.title, h1:document.querySelectorAll('h1').length, main:document.querySelectorAll('main').length, overflow:document.documentElement.scrollWidth > innerWidth, wide:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width && (r.right>innerWidth+2 || r.left < -2) && getComputedStyle(e).position !== 'absolute'}).slice(0,8).map(e=>e.className)})''')
            result.update(route=route, width=width, errors=errors)
            if route in ['/', '/en', '/games/ashbound', '/games/length-sense']:
                page.screenshot(path=str(OUT / f"{os.getenv('AUDIT_PHASE','before')}-{width}-{route.replace('/','_') or 'home'}.png"), full_page=True)
                # Full-page capture in this Chrome/Playwright combination clears
                # touch emulation. Restore it before checking pointer media rules.
                device.send('Emulation.setTouchEmulationEnabled', {'enabled':width < 500, 'maxTouchPoints':1})
            settings = page.locator('.platform-settings-button')
            settings.click()
            page.get_by_role('dialog').last.wait_for()
            result['settingsOverflow'] = page.evaluate('document.documentElement.scrollWidth > innerWidth')
            result['dialogFits'] = page.get_by_role('dialog').last.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight}')
            if width < 500:
                assert page.evaluate('matchMedia("(pointer:coarse)").matches')
                small = page.get_by_role('dialog').last.locator('button,select,.settings-list label').evaluate_all('(items)=>items.filter(e=>e.getBoundingClientRect().height<44).map(e=>({tag:e.tagName,cls:e.className,height:e.getBoundingClientRect().height,min:getComputedStyle(e).minHeight,coarse:matchMedia("(pointer:coarse)").matches}))')
                assert not small, (route, width, small)
            page.keyboard.press('Escape')
            page.remove_listener('pageerror', on_error)
            results.append(result)
            print(route, width, result, flush=True)
        context.close()
    browser.close()
(OUT / f"{os.getenv('AUDIT_PHASE','before')}.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
failures = [r for r in results if r['overflow'] or r['settingsOverflow'] or not r['dialogFits'] or r['errors'] or r['h1'] != 1 or r['main'] != 1]
assert not failures, failures
print(f'{len(results)} route/viewport checks passed (leaderboard API mocked)')
