const { chromium } = require('playwright');

async function getInteractiveElementsSnapshot() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('正在打开页面: https://hailiang.feishu.cn/wiki/Vu2FwwV0zinZM4kHooKcolzfn5c');
    await page.goto('https://hailiang.feishu.cn/wiki/Vu2FwwV0zinZM4kHooKcolzfn5c', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // 等待页面加载完成
    await page.waitForTimeout(3000);

    // 获取可交互元素
    const interactiveElements = await page.evaluate(() => {
      const elements = [];

      // 获取所有可交互元素
      const selectors = [
        'button',
        'a[href]',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[contenteditable="true"]',
        '[onclick]'
      ];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach((el, index) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            elements.push({
              tag: el.tagName.toLowerCase(),
              type: el.type || null,
              text: el.textContent?.trim().substring(0, 100) || null,
              href: el.href || null,
              role: el.getAttribute('role') || null,
              class: el.className || null,
              id: el.id || null,
              placeholder: el.placeholder || null,
              selector: selector,
              index: index,
              visible: el.offsetParent !== null,
              position: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              }
            });
          }
        });
      });

      return elements;
    });

    // 获取页面基本信息
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    console.log('\n========== 页面信息 ==========');
    console.log(JSON.stringify(pageInfo, null, 2));

    console.log('\n========== 可交互元素快照 ==========');
    console.log(`共找到 ${interactiveElements.length} 个可交互元素\n`);

    // 按类型分组
    const grouped = interactiveElements.reduce((acc, el) => {
      const key = el.role || el.tag;
      if (!acc[key]) acc[key] = [];
      acc[key].push(el);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([type, items]) => {
      console.log(`\n--- ${type.toUpperCase()} (${items.length}) ---`);
      items.slice(0, 10).forEach((el, i) => {
        console.log(`\n[${i + 1}] ${el.text || '(无文本)'}`);
        console.log(`    标签: ${el.tag}${el.type ? ` (${el.type})` : ''}`);
        console.log(`    位置: (${el.position.x}, ${el.position.y})`);
        console.log(`    尺寸: ${el.position.width}x${el.position.height}`);
        if (el.href) console.log(`    链接: ${el.href}`);
        if (el.placeholder) console.log(`    占位符: ${el.placeholder}`);
        if (el.class) console.log(`    类名: ${el.class.substring(0, 50)}`);
      });
      if (items.length > 10) {
        console.log(`    ... 还有 ${items.length - 10} 个${type}`);
      }
    });

    // 保存完整数据到文件
    const fs = require('fs');
    const output = {
      timestamp: new Date().toISOString(),
      pageInfo,
      interactiveElements
    };
    fs.writeFileSync('D:/Code/ZhiHuiCanMou/scripts/page-snapshot.json', JSON.stringify(output, null, 2));
    console.log('\n\n完整快照已保存到: D:/Code/ZhiHuiCanMou/scripts/page-snapshot.json');

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await browser.close();
  }
}

getInteractiveElementsSnapshot();
