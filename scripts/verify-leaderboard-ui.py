"""Chrome UI regression with explicitly mocked API responses (no Neon writes).

Run against `npm run dev`: python scripts/verify-leaderboard-ui.py
Requires the Python playwright package and installed Google Chrome.
Database/API integration is covered independently by server/leaderboard.test.ts.
"""
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'reports' / 'leaderboard'
OUTPUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get('WEB_GAME_URL', 'http://127.0.0.1:5173')


def check_ui(browser, width):
    context = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce')
    page = context.new_page()
    page.set_default_timeout(10_000)
    errors = []
    console_errors = []
    submissions = []
    boards = {}
    requested_boards = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    cdp = context.new_cdp_session(page)
    cdp.send('Runtime.enable')
    cdp.send('DOM.enable')

    def api(route):
        request = route.request
        if request.method == 'POST':
            body = request.post_data_json
            submissions.append(body)
            rows = [{'rank': 1, 'name': body['name'], 'score': body['score']}]
            boards[body['board']] = rows
            result = {'entries': rows, 'accepted': True, 'eligible': True, 'rank': 1}
        else:
            query = parse_qs(urlparse(request.url).query)
            requested_boards.append(query['board'][0])
            rows = boards.get(query['board'][0], [])
            result = {'entries': rows, 'eligible': 'score' in query, 'rank': 1 if 'score' in query else None}
        route.fulfill(status=200, content_type='application/json', body=json.dumps(result))

    context.route('**/api/leaderboard*', api)
    page.goto(BASE, wait_until='networkidle')
    page.screenshot(path=str(OUTPUT / f'initial-{width}.png'), full_page=True)
    print(json.dumps({'url': page.url, 'buttons': page.get_by_role('button').all_text_contents(), 'errors': errors, 'console': console_errors}), flush=True)
    page.get_by_role('button', name='查看線上排行榜 ↗').click()
    expect(page.get_by_text('還沒有人登榜，等你寫下第一筆紀錄。')).to_be_visible()
    page.get_by_label('選擇榜單').select_option('color-time')
    expect(page.get_by_role('heading', name='Color Links · 最快清空')).to_be_visible()
    page.get_by_role('button', name='關閉對話框').click()
    page.get_by_role('button', name='開始 灰燼墓誌', exact=True).click()
    page.get_by_role('button', name='喚醒守墓人').click()
    page.get_by_role('button', name='結束這次遠征', exact=True).click()
    page.get_by_role('button', name='確認結束並結算').click()
    expect(page.get_by_role('heading', name='此身長眠。餘火不滅。')).to_be_visible()
    expect(page.get_by_text('留下魂燼')).to_be_visible()
    expect(page.locator('.leaderboard-panel')).to_have_count(0)
    expect(page.get_by_role('textbox', name='排行榜名字')).to_have_count(0)
    assert 'ashbound-souls' not in requested_boards
    assert not submissions
    page.locator('.ash-ending').screenshot(path=str(OUTPUT / f'ash-ended-{width}.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
    # Inspect actual DOM layout via the Chrome DevTools Protocol.
    root = cdp.send('DOM.getDocument')['root']['nodeId']
    panel = cdp.send('DOM.querySelector', {'nodeId': root, 'selector': '.ash-ending'})['nodeId']
    box = cdp.send('DOM.getBoxModel', {'nodeId': panel})['model']
    assert box['width'] <= width
    page.get_by_role('button', name='遊戲廳', exact=True).click()
    page.get_by_role('button', name='查看線上排行榜 ↗').click()
    expect(page.get_by_label('選擇榜單').locator('option')).to_have_count(3)
    expect(page.locator('option[value="ashbound-souls"]')).to_have_count(0)
    expect(page.get_by_role('heading', name='Orchard Ten · 經典分數')).to_be_visible()
    expect(page.get_by_role('textbox')).to_have_count(0)
    page.screenshot(path=str(OUTPUT / f'lobby-{width}.png'), full_page=True)
    page.get_by_role('button', name='關閉對話框').click()
    # Real Color Links ending: advance the clock after the tutorial is dismissed.
    page.get_by_role('button', name='開始 Color Links', exact=True).click()
    page.get_by_role('button', name='開始串聯').click()
    page.get_by_role('button', name='略過說明並開始').click()
    page.clock.install()
    page.clock.fast_forward(31_000)
    expect(page.get_by_role('dialog', name='Color Links 遊戲結果')).to_be_visible()
    expect(page.get_by_role('heading', name='Color Links · 逾時消除')).to_be_visible()
    page.get_by_role('dialog').screenshot(path=str(OUTPUT / f'color-ended-{width}.png'))
    page.get_by_role('textbox', name='排行榜名字').fill('色彩玩家')
    page.get_by_role('button', name='儲存名字與成績').click()
    expect(page.get_by_text('成績已登錄！目前第 1 名。')).to_be_visible()
    assert submissions[0]['board'] == 'color-removed' and submissions[0]['score'] == 0
    # Navigate into Orchard Ten; Playwright's installed clock persists across navigation.
    page.goto(BASE + '/games/fruit-sum', wait_until='networkidle')
    page.get_by_role('button', name='開始經典模式').click()
    page.get_by_role('button', name='跳過', exact=True).click()
    page.clock.fast_forward(121_000)
    expect(page.get_by_role('dialog', name='本局結算')).to_be_visible()
    expect(page.get_by_role('heading', name='Orchard Ten · 經典分數')).to_be_visible()
    page.get_by_role('textbox', name='排行榜名字').fill('水果玩家')
    page.get_by_role('button', name='儲存名字與成績').click()
    expect(page.get_by_text('成績已登錄！目前第 1 名。')).to_be_visible()
    assert submissions[1]['board'] == 'fruit-classic' and submissions[1]['score'] == 0
    page.get_by_role('dialog').screenshot(path=str(OUTPUT / f'fruit-ended-{width}.png'))
    assert not errors, errors
    assert not console_errors, console_errors
    context.close()
    return {'width': width, 'pageErrors': errors, 'consoleErrors': console_errors, 'ashEndingWidth': box['width'], 'submissions': len(submissions)}


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=False)
    results = [check_ui(browser, width) for width in [1440, 390]]
    browser.close()
    (OUTPUT / 'verification.json').write_text(json.dumps(results, indent=2), encoding='utf8')
    print(json.dumps(results, indent=2))
