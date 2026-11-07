import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent
url=sys.argv[1] if len(sys.argv)>1 else ROOT.joinpath('index.html').as_uri()
with sync_playwright() as p:
    browser=p.chromium.launch()
    context=browser.new_context(color_scheme='dark',viewport={'width':390,'height':844})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(url)
    page.locator('#weather').wait_for(state='visible',timeout=30000)
    assert page.locator('html').get_attribute('data-theme')=='dark'
    assert page.locator('#theme-toggle').get_attribute('aria-pressed')=='true'
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('.hour svg use').count()==12
    assert page.evaluate("Array.from(document.querySelectorAll('use')).every(n=>document.querySelector(n.getAttribute('href')))")
    page.screenshot(path=str(ROOT.parent/'.media/weather-dark.png'),full_page=True)
    page.locator('#theme-toggle').focus()
    page.keyboard.press('Enter')
    assert page.locator('html').get_attribute('data-theme')=='light'
    page.reload()
    assert page.locator('html').get_attribute('data-theme')=='light'
    page.emulate_media(color_scheme='dark')
    assert page.locator('html').get_attribute('data-theme')=='light'
    page.locator('#weather').wait_for(state='visible',timeout=30000)
    page.screenshot(path=str(ROOT.parent/'.media/weather-light.png'),full_page=True)
    page.locator('#theme-toggle').click()
    page.reload()
    assert page.locator('html').get_attribute('data-theme')=='dark'
    for width in [320,390,1280]:
        page.set_viewport_size({'width':width,'height':900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
    blocked=browser.new_context(color_scheme='light')
    blocked.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new Error('Storage blocked')}})")
    other=blocked.new_page()
    other.on('pageerror',lambda e:errors.append(str(e)))
    other.goto(url)
    assert other.locator('html').get_attribute('data-theme')=='light'
    other.emulate_media(color_scheme='dark')
    other.wait_for_function("document.documentElement.dataset.theme==='dark'")
    other.locator('#theme-toggle').click()
    assert other.locator('html').get_attribute('data-theme')=='light'
    assert not errors, errors
    print('PASS THEMES: system default, both toggle directions, keyboard, persistence, explicit preference, blocked storage, responsive 320/390/1280, SVG references, no JS errors')
    browser.close()
