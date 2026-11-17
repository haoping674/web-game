import os, re, json
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'reports' / 'modern-web'
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.getenv('WEB_GAME_URL', 'http://127.0.0.1:5173')
results = []

def check(page, state):
    metrics = page.evaluate('''() => ({overflow:document.documentElement.scrollWidth>innerWidth, headings:[...document.querySelectorAll('main h1')].map(e=>e.textContent), focus:document.activeElement?.tagName})''')
    assert not metrics['overflow'], (state, metrics)
    assert len(metrics['headings']) == 1, (state, metrics)
    results.append({'state':state, **metrics})

with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width,height in [(1440,900),(390,844),(320,740),(844,390)]:
        context = browser.new_context(viewport={'width':width,'height':height}, is_mobile=width<900, has_touch=width<900, reduced_motion='reduce')
        page = context.new_page()
        device = context.new_cdp_session(page)
        page.set_default_timeout(10000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/api/leaderboard**', lambda r: r.fulfill(json={'entries':[], 'eligible':False, 'accepted':False, 'rank':None}))
        page.goto(BASE + '/')
        page.locator('h1').wait_for()
        page.keyboard.press('Tab')
        assert page.locator('.home-skip-link').evaluate('(e)=>e===document.activeElement')
        page.keyboard.press('Enter')
        assert page.locator('#game-library-title').evaluate('(e)=>e===document.activeElement')
        page.get_by_role('button',name='開始 秒感挑戰',exact=True).click()
        page.locator('#sense-title').wait_for()
        page.wait_for_function("document.activeElement?.id === 'sense-title'")
        page.get_by_role('button',name='開始計時',exact=True).click()
        page.get_by_role('button',name='停止計時',exact=True).click()
        check(page, f'{width}-second-result')

        page.goto(BASE + '/games/length-sense')
        slider = page.get_by_role('slider',name='調整線段長度')
        slider.focus()
        page.keyboard.press('ArrowRight')
        page.get_by_role('button',name='確認這個長度').click()
        check(page, f'{width}-length-result')

        for game, start in [('fruit-sum','開始經典模式'),('color-links','開始串聯'),('slide-ten','開始滑滑湊十')]:
            page.goto(BASE + '/games/' + game)
            page.get_by_role('button',name=re.compile(start)).click()
            skip = page.get_by_role('button',name=re.compile('略過說明並開始|^跳過$'))
            if skip.count(): skip.click()
            page.locator('.game-play-title').wait_for()
            print(width, game, flush=True)
            skip = page.get_by_role('button',name=re.compile('略過說明並開始|^跳過$'))
            if skip.count(): skip.click()
            check(page, f'{width}-{game}-playing')
            page.get_by_role('button',name='暫停遊戲').click()
            dialog = page.get_by_role('dialog').last
            dialog.wait_for()
            assert page.locator('.platform-header').evaluate('(e)=>e.inert')
            dialog.get_by_role('button',name='繼續遊戲').click()
            assert not page.locator('.platform-header').evaluate('(e)=>e.inert')
            assert page.get_by_role('button',name='暫停遊戲').evaluate('(e)=>!e.closest("[inert]")')
            if game == 'slide-ten':
                # Install a virtual clock only after resume to avoid wall-clock waits.
                page.clock.install()
                page.clock.run_for(200000)
                dialog = page.get_by_role('dialog').last
                dialog.wait_for()
                summary = dialog.locator('summary')
                summary.focus()
                page.keyboard.press('Tab')
                assert dialog.locator('button').first.evaluate('(e)=>e===document.activeElement')
                summary.click()
                page.get_by_role('button',name=re.compile('分享成績')).click()
                share = page.get_by_role('dialog').last
                share.wait_for()
                page.keyboard.press('Escape')
                assert dialog.is_visible()
                assert dialog.evaluate('(e)=>!e.closest("[inert]")')
                check(page, f'{width}-slide-result-after-share')
                page.screenshot(path=str(OUT / f'interaction-{width}-{game}.png'), full_page=True)
                device.send('Emulation.setTouchEmulationEnabled', {'enabled':width < 900, 'maxTouchPoints':1})
                page.clock.resume()
        for game, action in [('sprout-island','怎麼玩'),('ashbound','遊玩指南')]:
            page.goto(BASE + '/games/' + game)
            page.locator('h1').wait_for()
            check(page, f'{width}-{game}-initial')
            # Settings exercise inherited theme and native controls in both variants.
            page.locator('.platform-settings-button').click()
            page.get_by_role('dialog').last.wait_for()
            page.keyboard.press('Escape')
        page.goto(BASE + '/en/games/length-sense')
        page.get_by_role('slider',name='Adjust line length').focus()
        page.keyboard.press('ArrowRight')
        page.get_by_role('button',name='Confirm length').click()
        check(page, f'{width}-en-length-result')
        page.goto(BASE + '/en/games/second-sense')
        page.get_by_role('button',name='Start timer',exact=True).click()
        page.get_by_role('button',name='Stop timer',exact=True).click()
        check(page, f'{width}-en-second-result')
        for game, selector in [('fruit-sum','.start-screen .primary-button'),('color-links','.color-primary'),('slide-ten','.slide-start .primary-button')]:
            page.goto(BASE + '/en/games/' + game)
            page.locator(selector).click()
            skip = page.get_by_role('button',name=re.compile('Skip and play|^Skip$'))
            if skip.count(): skip.click()
            page.locator('.game-play-title').wait_for()
            check(page, f'{width}-en-{game}-playing')
            page.get_by_role('button',name='Pause game').click()
            page.get_by_role('dialog').last.get_by_role('button',name='Resume').click()
        assert not errors, errors
        context.close()
    browser.close()
(OUT/'interactions.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'{len(results)} gameplay checks passed')
