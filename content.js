// 全局设置 - 启用更多日志以便调试
const ENABLE_DEBUG_LOG = true;
const MAX_RETRY_ATTEMPTS = 10;

// Track translated tweets
const translatedTweets = new Map(); // Use Map to store tweet data and translations
const authorCache = new Map(); // Cache for author information (avatar URL, name, handle)

// 性能监控
const performanceStats = {
  scansPerformed: 0,
  buttonsAdded: 0,
  lastScanTime: 0
};

// 日志函数
function debugLog(...args) {
  if (ENABLE_DEBUG_LOG) {
    console.log(`[翻译扩展]`, ...args);
  }
}

// 清理重复按钮函数 - 新增
function cleanupDuplicateButtons() {
  // 查找所有翻译按钮
  const buttons = document.querySelectorAll('.translate-button');
  
  // 如果按钮数量异常，进行清理
  if (buttons.length > 3) {
    debugLog(`检测到${buttons.length}个按钮，清理重复按钮`);
    
    // 为每个推文元素保留一个按钮
    const processedTweets = new Set();
    
    buttons.forEach(button => {
      // 找到按钮所属的推文
      const tweetContainer = button.closest('article') || button.parentElement;
      if (!tweetContainer) return;
      
      const tweetId = tweetContainer.dataset.testid || tweetContainer.id || 
                     tweetContainer.querySelector('[data-testid="tweetText"]')?.textContent.substring(0, 20) || 
                     JSON.stringify(tweetContainer.getBoundingClientRect());
      
      // 如果这个推文已经处理过，删除额外的按钮
      if (processedTweets.has(tweetId)) {
        button.remove();
      } else {
        processedTweets.add(tweetId);
      }
    });
    
    // 显示清理结果
    debugLog(`清理完成，剩余${document.querySelectorAll('.translate-button').length}个按钮`);
  }
}

// 清理翻译失败的错误消息 - 新增
function cleanupErrorMessages() {
  // 查找所有包含翻译失败的按钮
  const errorButtons = document.querySelectorAll('.translate-button-error');
  
  errorButtons.forEach(button => {
    // 如果是超过30秒的错误按钮，恢复为正常状态
    const timestamp = parseInt(button.getAttribute('data-error-time') || '0');
    if (timestamp && (Date.now() - timestamp > 30000)) {
      button.textContent = '翻译';
      button.disabled = false;
      button.classList.remove('translate-button-error');
      button.removeAttribute('data-error-time');
    }
  });
}

// 强化版 - 添加翻译按钮（使用多种选择器策略，增加防重复逻辑）
function addTranslationButtons(forceFullScan = false) {
  if (!window.location.href.includes('twitter.com') && !window.location.href.includes('x.com')) return; // Only on X.com

  // 先清理重复按钮
  cleanupDuplicateButtons();
  
  // 清理过期的错误消息
  cleanupErrorMessages();

  performanceStats.scansPerformed++;
  performanceStats.lastScanTime = Date.now();
  
  try {
    // 多种选择器策略以确保覆盖所有推文，但更加精确
    const selectors = [
      // 主时间线推文 - 更严格的选择器
      'article[data-testid="tweet"]:not([data-translated="true"]) div[data-testid="tweetText"]:not(:has(.translate-button))',
      // 详情页推文内容
      'div[data-testid="tweetText"]:not(:has(.translate-button))',
      // 引用推文内容
      'div[data-testid="tweet"] div[data-testid="tweetText"]:not(:has(.translate-button))',
      // 通用推文容器
      'div[data-testid="cellInnerDiv"] article div[data-testid="tweetText"]:not(:has(.translate-button))'
      // 移除过于宽泛的选择器，避免错误添加按钮
    ];
    
    let totalCandidates = 0;
    let addedCount = 0;
    
    // 对每个选择器策略执行扫描
    selectors.forEach(selector => {
      try {
        const tweets = document.querySelectorAll(selector);
        totalCandidates += tweets.length;
        
        debugLog(`选择器 "${selector}" 找到 ${tweets.length} 条未处理的推文`);
        
        tweets.forEach(tweet => {
          // 忽略过短的文本内容
          if (tweet.textContent.trim().length < 5) {
            debugLog('推文内容太短，跳过');
            return;
          }
          
          // 强化检查：确保没有已添加的翻译按钮
          if (tweet.querySelector('.translate-button') || 
              tweet.parentNode.querySelector('.translate-button') || 
              tweet.closest('article')?.querySelector('.translate-button')) {
            debugLog('该推文已有翻译按钮，跳过');
            return;
          }
          
          // 检查推文是否已经有翻译结果或失败消息
          if (tweet.parentNode.querySelector('.translated-text') || 
              tweet.textContent.includes('[翻译失败') || 
              tweet.parentNode.textContent.includes('[翻译失败')) {
            debugLog('该推文已有翻译结果或失败信息，跳过');
            return;
          }
          
          // 获取推文ID或生成随机ID
          const tweetElement = tweet.closest('article[data-testid="tweet"]');
          
          // 标记已处理
          let tweetId;
          if (tweetElement) {
            tweetId = tweetElement.getAttribute('data-testid') || 
                     tweetElement.id || 
                     'tweet-' + Date.now() + Math.random().toString(36).substr(2, 5);
            
            // 检查这个推文是否已经处理过
            if (tweetElement.getAttribute('data-translated') === 'true') {
              debugLog('推文已标记为已处理，跳过');
              return;
            }
            
            tweetElement.setAttribute('data-translated', 'true');
          } else {
            // 为没有标准article容器的推文创建一个唯一ID
            tweetId = 'tweet-' + Date.now() + Math.random().toString(36).substr(2, 5);
            tweet.setAttribute('data-tweet-id', tweetId);
          }
          
          if (translatedTweets.has(tweetId)) {
            debugLog('推文已在翻译记录中，跳过');
            return;
          }
          
          // 添加翻译按钮
          const button = document.createElement('button');
          button.className = 'translate-button';
          button.innerText = '翻译'; // Button name is "翻译"
          button.setAttribute('data-tweet-id', tweetId);
          
          // 防止事件冒泡导致推文被点击
          button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            translateTweet(tweet, tweetId, button);
          });
          
          // 把按钮添加到推文内容后面，确保正确的DOM位置
          tweet.appendChild(button);
          addedCount++;
          
          // 调试信息
          debugLog(`已添加翻译按钮到推文: ${tweet.textContent.substring(0, 30)}...`);
        });
      } catch (selectorError) {
        console.error(`选择器 "${selector}" 处理出错:`, selectorError);
      }
    });
    
    performanceStats.buttonsAdded += addedCount;
    
    if (addedCount > 0 || totalCandidates > 0) {
      debugLog(`本次扫描共找到 ${totalCandidates} 条推文，添加了 ${addedCount} 个翻译按钮`);
    }
    
    // 在强制全页面扫描模式下，专门处理详情页面的主推文
    if (forceFullScan && (window.location.href.includes('/status/') || window.location.href.includes('/tweet/'))) {
      debugLog(`正在强制扫描详情页主推文...`);
      const mainTweetSelectors = [
        'div[data-testid="tweet"] div[data-testid="tweetText"]',
        'article[data-testid="tweet"] div[data-testid="tweetText"]',
        'div[aria-labelledby][role="article"] div[data-testid="tweetText"]'
      ];
      
      for (const selector of mainTweetSelectors) {
        try {
          const mainTweet = document.querySelector(selector);
          if (mainTweet && !mainTweet.querySelector('.translate-button') && 
              !mainTweet.parentNode.querySelector('.translate-button') &&
              !mainTweet.parentNode.querySelector('.translated-text')) {
              
            debugLog(`找到详情页主推文，添加翻译按钮`);
            
            // 添加按钮
            const button = document.createElement('button');
            button.className = 'translate-button';
            button.textContent = '翻译';
            
            // 获取或生成一个ID
            const tweetId = 'main-' + Date.now();
            button.setAttribute('data-tweet-id', tweetId);
            
            button.addEventListener('click', (e) => {
              e.stopPropagation();
              translateTweet(mainTweet, tweetId, button);
            });
            
            mainTweet.appendChild(button);
            debugLog(`已添加翻译按钮到详情页主推文`);
            break;
          }
        } catch (selectorError) {
          console.error(`详情页主推文选择器 "${selector}" 处理出错:`, selectorError);
        }
      }
    }
  } catch (error) {
    console.error('添加翻译按钮时出错:', error);
  }
}

// 添加手动扫描按钮
function addScanButton() {
  if (!window.location.href.includes('twitter.com') && !window.location.href.includes('x.com')) return;
  
  debugLog("添加手动扫描按钮...");
  
  // 检查是否已经存在
  if (document.querySelector('#manual-scan-button')) return;
  
  const scanButton = document.createElement('button');
  scanButton.id = 'manual-scan-button';
  scanButton.textContent = '🔍 扫描推文';
  scanButton.title = '手动扫描页面上的所有推文，添加翻译按钮';
  
  // 样式设置
  Object.assign(scanButton.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '9999',
    padding: '8px 12px',
    backgroundColor: 'rgba(29, 155, 240, 0.9)',
    color: 'white',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
  });
  
  // 鼠标悬停效果
  scanButton.onmouseover = () => {
    scanButton.style.backgroundColor = 'rgba(29, 155, 240, 1)';
  };
  
  scanButton.onmouseout = () => {
    scanButton.style.backgroundColor = 'rgba(29, 155, 240, 0.9)';
  };
  
  // 点击事件
  scanButton.addEventListener('click', () => {
    debugLog("手动扫描按钮被点击");
    scanButton.textContent = '🔄 扫描中...';
    scanButton.disabled = true;
    
    // 清理现有错误和重复按钮
    cleanupDuplicateButtons();
    cleanupErrorMessages();
    
    // 执行深度扫描
    addTranslationButtons(true);
    
    // 显示扫描结果
    setTimeout(() => {
      scanButton.textContent = `✅ 已扫描 (${performanceStats.buttonsAdded})`;
      
      // 恢复按钮状态
      setTimeout(() => {
        scanButton.textContent = '🔍 扫描推文';
        scanButton.disabled = false;
      }, 2000);
    }, 1000);
  });
  
  document.body.appendChild(scanButton);
}

// 添加紧急修复按钮 - 新增
function addEmergencyFixButton() {
  if (!window.location.href.includes('twitter.com') && !window.location.href.includes('x.com')) return;
  
  // 检查是否已经存在
  if (document.querySelector('#emergency-fix-button')) return;
  
  const fixButton = document.createElement('button');
  fixButton.id = 'emergency-fix-button';
  fixButton.textContent = '🛠️ 修复问题';
  fixButton.title = '修复重复按钮和错误状态';
  
  // 样式设置
  Object.assign(fixButton.style, {
    position: 'fixed',
    bottom: '70px',
    right: '20px',
    zIndex: '9999',
    padding: '8px 12px',
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    color: 'white',
    border: 'none',
    borderRadius: '50px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
  });
  
  // 鼠标悬停效果
  fixButton.onmouseover = () => {
    fixButton.style.backgroundColor = 'rgba(220, 53, 69, 1)';
  };
  
  fixButton.onmouseout = () => {
    fixButton.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
  };
  
  // 点击事件
  fixButton.addEventListener('click', () => {
    debugLog("紧急修复按钮被点击");
    fixButton.textContent = '🔄 修复中...';
    fixButton.disabled = true;
    
    // 移除所有翻译按钮和结果，完全重置
    document.querySelectorAll('.translate-button, .translated-text').forEach(el => el.remove());
    
    // 重置所有推文的标记
    document.querySelectorAll('article[data-translated="true"]').forEach(article => {
      article.removeAttribute('data-translated');
    });
    
    // 清空翻译记录
    translatedTweets.clear();
    
    // 重新添加按钮
    setTimeout(() => {
      addTranslationButtons(true);
      
      fixButton.textContent = '✅ 已修复';
      setTimeout(() => {
        fixButton.textContent = '🛠️ 修复问题';
        fixButton.disabled = false;
      }, 2000);
    }, 500);
  });
  
  document.body.appendChild(fixButton);
}

// 设置滚动检测 - 使用Intersection Observer监控推文进入视口
function setupScrollDetection() {
  // 如果不是X.com，不执行
  if (!window.location.href.includes('twitter.com') && !window.location.href.includes('x.com')) return;
  
  debugLog("设置增强的滚动检测...");
  
  // 使用防抖动的滚动处理
  let scrollDebounceTimer;
  
  window.addEventListener('scroll', () => {
    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
      debugLog("检测到滚动事件，扫描新推文");
      addTranslationButtons();
    }, 300); // 300ms防抖动
  }, { passive: true });
  
  // 使用Intersection Observer API监测元素进入视口
  const observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      debugLog("检测到新的内容进入视口，添加翻译按钮");
      // 当有元素进入视口时，检查并添加翻译按钮
      addTranslationButtons();
    }
  }, {
    root: null, // 相对于视口
    rootMargin: '0px',
    threshold: 0.1 // 当10%的元素可见时触发
  });
  
  // 观察主时间线区域和可能的推文详情区域
  const timelineAreas = document.querySelectorAll('section[role="region"], div[aria-label="Timeline"]');
  timelineAreas.forEach(area => {
    debugLog("开始观察区域:", area);
    observer.observe(area);
  });

  // 定期检查DOM以确保覆盖所有可能的情况
  setInterval(() => {
    const newAreas = document.querySelectorAll('section[role="region"]:not([data-observed]), div[aria-label="Timeline"]:not([data-observed])');
    newAreas.forEach(area => {
      debugLog("发现新的内容区域，开始观察");
      observer.observe(area);
      area.setAttribute('data-observed', 'true');
    });
  }, 2000);
  
  return observer;
}

// 增强的URL变化检测
function setupURLChangeDetection() {
  // 如果不是X.com，不执行
  if (!window.location.href.includes('twitter.com') && !window.location.href.includes('x.com')) return;
  
  debugLog("设置增强的URL变化检测...");
  
  // 当前URL
  let currentUrl = window.location.href;
  let retryCount = 0;
  
  // 函数：处理URL变化
  function handleUrlChange(newUrl) {
    debugLog(`URL变化: ${currentUrl} => ${newUrl}`);
    currentUrl = newUrl;
    retryCount = 0;
    
    // 清理重复按钮和错误
    cleanupDuplicateButtons();
    cleanupErrorMessages();
    
    // 更激进的方法：多次尝试添加按钮，确保内容加载完毕
    function retryAddingButtons() {
      if (retryCount >= MAX_RETRY_ATTEMPTS) return;
      
      debugLog(`URLChange: 第${retryCount+1}次尝试添加翻译按钮`);
      addTranslationButtons(true); // 强制全面扫描
      
      retryCount++;
      setTimeout(retryAddingButtons, retryCount * 500); // 递增间隔
    }
    
    // 先等待一点时间让页面加载，然后开始尝试
    setTimeout(retryAddingButtons, 800);
  }
  
  // 定期检查URL变化 - 更频繁检查
  setInterval(() => {
    if (currentUrl !== window.location.href) {
      handleUrlChange(window.location.href);
    }
  }, 300);
  
  // 重写history方法以捕获SPA导航
  const originalPushState = history.pushState;
  history.pushState = function() {
    originalPushState.apply(this, arguments);
    debugLog("检测到 pushState 调用");
    if (currentUrl !== window.location.href) {
      handleUrlChange(window.location.href);
    }
  };
  
  const originalReplaceState = history.replaceState;
  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    debugLog("检测到 replaceState 调用");
    if (currentUrl !== window.location.href) {
      handleUrlChange(window.location.href);
    }
  };
  
  // 监听浏览器前进/后退
  window.addEventListener('popstate', () => {
    debugLog("检测到 popstate 事件");
    if (currentUrl !== window.location.href) {
      handleUrlChange(window.location.href);
    }
  });
}

// 设置DOM变更观察
function setupDOMObserver() {
  if (!window.location.href.includes('twitter.com') && !window.location.href.includes('x.com')) return;
  
  debugLog("设置DOM变更观察器...");
  
  // 防止过多调用的节流变量
  let throttled = false;
  
  // 主DOM观察器 - 观察整个body的变化
  const bodyObserver = new MutationObserver((mutations) => {
    // 使用节流来减少频繁调用
    if (!throttled) {
      throttled = true;
      
      setTimeout(() => {
        debugLog("检测到DOM变更，扫描新推文");
        addTranslationButtons();
        throttled = false;
      }, 1000); // 1秒节流
    }
  });
  
  // 观察body的变化，减少观察范围和深度
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false, // 不观察属性变化，减少触发频率
    characterData: false // 不观察文本变化，减少触发频率
  });
  
  // 特定容器的观察器 - 更精细地观察主要内容区域
  function observeSpecificContainers() {
    const contentSelectors = [
      'div[data-testid="primaryColumn"]',
      'section[role="region"]'
    ];
    
    contentSelectors.forEach(selector => {
      try {
        const containers = document.querySelectorAll(selector);
        containers.forEach(container => {
          if (!container.hasAttribute('data-mut-observed')) {
            const containerObserver = new MutationObserver((mutations) => {
              // 特定容器内的变化可以更快地响应
              if (!throttled) {
                throttled = true;
                setTimeout(() => {
                  debugLog(`容器 "${selector}" 内容变化，扫描新推文`);
                  addTranslationButtons();
                  throttled = false;
                }, 800);
              }
            });
            
            containerObserver.observe(container, {
              childList: true,
              subtree: true,
              attributes: false,
              characterData: false
            });
            
            container.setAttribute('data-mut-observed', 'true');
            debugLog(`开始观察容器内变化: ${selector}`);
          }
        });
      } catch (error) {
        console.error(`监控容器 "${selector}" 时出错:`, error);
      }
    });
  }
  
  // 立即观察现有容器
  observeSpecificContainers();
  
  // 定期检查新的容器
  setInterval(observeSpecificContainers, 5000);
  
  return bodyObserver;
}

// Translate a single tweet - 增强错误处理和DOM安全性
async function translateTweet(tweet, tweetId, button) {
  if (!window.location.href.includes('twitter.com') && !window.location.href.includes('x.com')) return;
  
  // 检查元素是否仍在DOM中
  if (!document.body.contains(tweet) || !document.body.contains(button)) {
    debugLog('目标推文或按钮已不在DOM中，取消翻译');
    return;
  }

  // 检查是否已经有翻译结果
  if (tweet.parentNode && tweet.parentNode.querySelector('.translated-text')) {
    debugLog('该推文已有翻译结果，不重复翻译');
    return;
  }

  // 设置按钮为加载状态
  button.disabled = true;
  button.innerText = '翻译中...';
  button.classList.add('translate-button-loading');

  try {
    // 获取翻译设置
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['activeAiProvider', 'deepseekApiKey', 'kimiApiKey', 'openaiApiKey', 'translationEnabled', 'flomoApi'], resolve);
    });

    const activeAi = settings.activeAiProvider || 'deepseek'; // Default to DeepSeek
    const apiKey = settings[activeAi + 'ApiKey'] || '';
    const translationEnabled = settings.translationEnabled !== false; // Default enabled
    const flomoApiEndpoint = settings.flomoApi || ''; // 修改这里：使用flomoApi键名

    debugLog('获取到Flomo API:', flomoApiEndpoint); // 调试日志
    debugLog('当前AI提供商:', activeAi);
    debugLog('获取的API密钥:', apiKey ? '已设置' : '未设置');

    if (!apiKey && activeAi !== 'google-free') {
      restoreButton(button, '[翻译失败，请设置API密钥]');
      return;
    }

    if (!translationEnabled) {
      restoreButton(button, '[翻译已暂停]');
      return;
    }

    // 安全地获取文本内容
    if (!document.body.contains(tweet)) {
      debugLog('推文元素已不在DOM中，取消翻译');
      return;
    }
    
    const originalText = tweet.innerText.trim().replace(/翻译$/, ''); // 移除可能包含的"翻译"按钮文本
    if (!originalText) {
      restoreButton(button, '[无文本可翻译]');
      return;
    }

    // 使用谷歌免费翻译
    let translated;
    if (activeAi === 'google-free') {
      // 使用Google免费翻译
      try {
        const googleTranslator = new GoogleFreeTranslator();
        translated = await googleTranslator.translate(originalText, 'zh-CN');
        if (!translated) throw new Error('Google翻译返回空结果');
      } catch (error) {
        console.error('Google免费翻译失败:', error);
        restoreButton(button, '[Google翻译失败]');
        return;
      }
    } else {
      // 使用API进行翻译
      try {
        translated = await translateText(originalText, apiKey, activeAi, 10000); // 增加超时时间
        if (!translated || translated.includes('[翻译失败')) throw new Error('API返回错误');
      } catch (error) {
        console.error('API翻译失败:', error);
        restoreButton(button, '[API翻译失败，请重试]');
        return;
      }
    }

    // 再次检查元素是否仍在DOM中
    if (!document.body.contains(tweet) || !document.body.contains(button)) {
      debugLog('翻译过程中推文或按钮已从DOM中移除，取消显示结果');
      return;
    }

    // 再次检查是否已经有翻译结果
    if (tweet.parentNode && tweet.parentNode.querySelector('.translated-text')) {
      debugLog('翻译过程中已有其他翻译结果添加，取消显示');
      if (document.body.contains(button)) {
        button.remove(); // 安全地移除多余的按钮
      }
      return;
    }

    // Create translated text container (with "保存到 Flomo" button)
    const translationDiv = document.createElement('div');
    translationDiv.className = 'translated-text';
    translationDiv.innerHTML = `
      <div>${activeAi === 'google-free' ? 'Google翻译' : activeAi.charAt(0).toUpperCase() + activeAi.slice(1)}翻译：${translated}</div>
      ${flomoApiEndpoint ? '<button class="save-to-flomo-button">保存到 Flomo</button>' : ''}
    `;

    // Apply adaptive width based on tweet container
    const tweetContainer = tweet.closest('article[data-testid="tweet"]');
    if (tweetContainer) {
      translationDiv.style.maxWidth = `${tweetContainer.offsetWidth}px`;
    }

    // Add "保存到 Flomo" button event listener
    const saveButton = translationDiv.querySelector('.save-to-flomo-button');
    if (saveButton) {
      saveButton.addEventListener('click', async (e) => {
        e.stopPropagation(); // 防止冒泡
        
        if (!flomoApiEndpoint) {
          showToast('请在侧栏设置中绑定 Flomo API 端点');
          return;
        }

        debugLog('尝试保存到Flomo, API地址:', flomoApiEndpoint); // 调试信息

        try {
          showToast('正在保存到 Flomo...');
          // 通过background.js中转请求以避免CORS问题
          chrome.runtime.sendMessage({
            action: "saveToFlomo",
            flomoApi: flomoApiEndpoint,
            content: `${originalText}\n${translated} #flomo ${window.location.href}`
          }, response => {
            if (response && response.success) {
              showToast('成功保存到 Flomo！');
              debugLog('Successfully saved to Flomo:', response);
            } else {
              const errorMsg = response ? response.error : '未知错误';
              showToast(`保存失败：${errorMsg}`);
              console.error('Failed to save to Flomo:', errorMsg);
            }
          });
        } catch (error) {
          console.error('Failed to save to Flomo:', error);
          showToast(`保存失败：${error.message || '请检查 Flomo API 端点'}`);
        }
      });
    }

    // 安全地移除按钮并添加翻译结果
    try {
      // 确保按钮仍在DOM中
      if (button && document.body.contains(button)) {
        // 安全地移除按钮 - 修复了这里以防止removeChild错误
        if (button.parentNode) {
          try {
            button.parentNode.removeChild(button);
          } catch (removeError) {
            // 如果removeChild失败，尝试直接使用remove()方法
            button.remove();
          }
        } else {
          button.remove();
        }
      }
      
      // 确保tweet仍在DOM中并且有父节点
      if (tweet && document.body.contains(tweet) && tweet.parentNode) {
        tweet.parentNode.appendChild(translationDiv);
      } else {
        debugLog('推文元素已不在DOM中或没有父节点，无法添加翻译结果');
      }
      
      // 更新已翻译记录
      translatedTweets.set(tweetId, { 
        original: originalText, 
        translated: translated 
      });
      
      // 标记文章为已翻译
      const articleElement = tweet.closest('article');
      if (articleElement) {
        articleElement.setAttribute('data-translated', 'true');
      }
    } catch (domError) {
      // 捕获任何DOM操作错误
      console.error('DOM操作失败:', domError);
      debugLog('DOM错误详情:', domError.message);
      showToast('翻译成功，但显示结果时出错');
    }
  } catch (error) {
    console.error('Translation failed:', error);
    
    // 安全地恢复按钮状态
    if (button && document.body.contains(button)) {
      // 更具体的错误消息
      let errorMessage = '请重试';
      if (error.message.includes('API')) {
        errorMessage = 'API错误';
      } else if (error.message.includes('网络')) {
        errorMessage = '网络问题';
      } else if (error.message.includes('超时')) {
        errorMessage = '请求超时';
      } else if (error.message.length < 30) {
        errorMessage = error.message;
      }
      
      restoreButton(button, `[翻译失败: ${errorMessage}]`);
    }
  }
}

// Restore button state - 增强安全性
function restoreButton(button, text) {
  // 检查按钮是否还在DOM中
  if (!button || !document.body.contains(button)) {
    debugLog('尝试恢复不存在的按钮，操作已取消');
    return;
  }

  button.disabled = false;
  button.innerText = text;
  button.classList.remove('translate-button-loading');
  
  if (text !== '翻译') {
    button.classList.add('translate-button-error');
    // 记录错误时间戳，用于自动恢复
    button.setAttribute('data-error-time', Date.now().toString());
    
    // 3秒后自动恢复按钮文本为"翻译"
    setTimeout(() => {
      if (button && document.body.contains(button)) {
        button.textContent = '翻译';
        button.classList.remove('translate-button-error');
        button.disabled = false;
      }
    }, 3000);
  } else {
    button.classList.remove('translate-button-error');
  }
}

// Translate text using DeepSeek or Kimi API (optimized for speed)
async function translateText(text, apiKey, aiProvider, timeout = 10000) {
  // 记录开始时间用于调试
  const startTime = Date.now();
  debugLog(`开始${aiProvider}翻译，文本长度: ${text.length}字符`);
  
  const apiUrl = aiProvider === 'deepseek' ? 'https://api.deepseek.com/v1/chat/completions' : 
                 aiProvider === 'kimi' ? 'https://api.moonshot.cn/v1/chat/completions' : 
                 'https://api.openai.com/v1/chat/completions';
  const model = aiProvider === 'deepseek' ? 'deepseek-chat' : 
                aiProvider === 'kimi' ? 'moonshot-v1-8k' : 
                'gpt-3.5-turbo';

  try {
    // Use fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { "role": "system", "content": "You are a concise translator. Translate the following text into Chinese if it's English, or to English if it's Chinese, keeping it brief and accurate." },
          { "role": "user", "content": text }
        ],
        stream: false,
        max_tokens: 150 // 增加响应长度限制，避免长文本被截断
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    // 记录API响应时间
    debugLog(`${aiProvider} API响应时间: ${Date.now() - startTime}ms`);

    if (!response.ok) {
      const errorText = await response.text().catch(e => "无法获取错误详情");
      throw new Error(`${aiProvider} API请求失败: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('API响应格式错误');
    }
    
    const result = data.choices[0].message.content.trim();
    debugLog(`翻译完成，耗时: ${Date.now() - startTime}ms, 结果长度: ${result.length}字符`);
    
    return result || '[翻译失败]'; // Extract and trim translation result
  } catch (error) {
    debugLog(`翻译错误，耗时: ${Date.now() - startTime}ms, 错误: ${error.message}`);
    
    if (error.name === 'AbortError') {
      throw new Error('翻译超时，请检查网络或重试');
    } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('网络连接失败，请检查网络或API服务器状态');
    }
    throw error;
  }
}

// Google免费翻译实现
class GoogleFreeTranslator {
  constructor() {
    this.baseUrl = 'https://translate.googleapis.com/translate_a/single';
    this.userAgent = navigator.userAgent;
  }

  /**
   * 翻译文本
   * @param {string} text - 要翻译的文本
   * @param {string} targetLang - 目标语言代码，默认为'zh-CN'（简体中文）
   * @returns {Promise<string>} - 翻译后的文本
   */
  async translate(text, targetLang = 'zh-CN') {
    if (!text || text.trim() === '') {
      return '';
    }
    
    debugLog(`开始Google免费翻译，文本长度: ${text.length}字符`);
    const startTime = Date.now();

    try {
      // 构建请求URL和参数
      const params = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',  // 自动检测源语言
        tl: targetLang,
        dt: 't',     // 返回翻译
        q: text,
      });

      // 发送请求
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          'Content-Type': 'application/json',
        },
      });
      
      debugLog(`Google API响应时间: ${Date.now() - startTime}ms`);

      if (!response.ok) {
        throw new Error(`翻译请求失败: ${response.status} ${response.statusText}`);
      }

      // 解析响应
      const data = await response.json();
      
      // 提取翻译结果
      let translatedText = '';
      if (data && data[0]) {
        for (let i = 0; i < data[0].length; i++) {
          if (data[0][i][0]) {
            translatedText += data[0][i][0];
          }
        }
      }
      
      debugLog(`Google翻译完成，耗时: ${Date.now() - startTime}ms, 结果长度: ${translatedText.length}字符`);

      return translatedText;
    } catch (error) {
      debugLog(`Google翻译错误，耗时: ${Date.now() - startTime}ms, 错误: ${error.message}`);
      console.error('Google免费翻译API错误:', error);
      throw error;
    }
  }
}

// Get or cache author information (optimized for X.com's DOM)
function getAuthorInfo(tweetId) {
  try {
    // 首先检查缓存中是否已有该信息
    if (authorCache.has(tweetId)) {
      return authorCache.get(tweetId);
    }

    // 找到推文元素
    const tweetElement = document.querySelector(`article[data-testid="tweet"][data-translated="true"]`);
    if (!tweetElement) {
      console.error('找不到推文元素');
      return null;
    }

    // 获取头像
    const avatarImg = tweetElement.querySelector('img[src*="profile_images"]');
    const avatarUrl = avatarImg ? avatarImg.src : null;
    
    // 获取作者信息区域
    const userInfoSection = tweetElement.querySelector('div[data-testid="User-Name"]');
    if (!userInfoSection) {
      console.error('找不到用户信息区域');
      return null;
    }
    
    // 获取作者名称 - 通常是第一个链接中的文本
    const nameElement = userInfoSection.querySelector('a span');
    const authorName = nameElement ? nameElement.textContent.trim() : '未知用户';
    
    // 获取作者用户名(@handle) - 通常在一个带dir="ltr"属性的span中
    let authorHandle = '';
    const usernameElements = userInfoSection.querySelectorAll('span');
    for (const elem of usernameElements) {
      const text = elem.textContent.trim();
      if (text.includes('@')) {
        authorHandle = text.replace('@', ''); // 移除@符号
        break;
      }
    }
    
    // 如果未找到用户名，尝试从URL中提取
    if (!authorHandle) {
      const urlPath = window.location.pathname;
      const urlParts = urlPath.split('/');
      if (urlParts.length >= 2) {
        authorHandle = urlParts[1]; // 从URL路径获取用户名
      } else {
        authorHandle = 'unknown';
      }
    }
    
    const authorInfo = { avatarUrl, authorName, authorHandle };
    
    // 缓存结果
    authorCache.set(tweetId, authorInfo);
    
    debugLog('已获取作者信息:', authorInfo);
    return authorInfo;
  } catch (error) {
    console.error('获取作者信息失败:', error);
    return {
      avatarUrl: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png', // 默认头像
      authorName: '未知用户',
      authorHandle: 'unknown'
    };
  }
}

// Show toast notification
function showToast(message) {
  try {
    // 检查是否已存在toast元素
    let toast = document.querySelector('.tweet-translator-toast');
    
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'tweet-translator-toast';
      
      // 设置样式
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '5px',
        zIndex: '10000',
        transition: 'opacity 0.3s ease',
        opacity: '0',
        maxWidth: '80%',
        textAlign: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        fontSize: '14px'
      });
      
      document.body.appendChild(toast);
    }
    
    // 更新消息并显示
    toast.textContent = message;
    
    // 在下一帧添加显示类，确保过渡效果生效
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      
      // 3秒后隐藏
      setTimeout(() => {
        toast.style.opacity = '0';
        
        // 等待过渡完成后移除
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }, 3000);
    });
  } catch (toastError) {
    console.error('显示提示消息失败:', toastError);
  }
}

// ===================== 任何网页文本翻译 =====================

// 创建一个浮动翻译按钮，在文本选择后显示
function createFloatingTranslateButton(selection) {
  debugLog('创建浮动翻译按钮');
  // 移除已存在的浮动按钮，避免重复
  removeExistingFloatingButton();
  
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  
  const button = document.createElement('div');
  button.className = 'floating-translate-button';
  button.innerHTML = '翻译所选内容';
  button.style.position = 'absolute';
  button.style.top = `${window.scrollY + rect.bottom + 5}px`;
  button.style.left = `${window.scrollX + rect.left}px`;
  button.style.zIndex = '10000';
  button.style.padding = '5px 10px';
  button.style.backgroundColor = 'rgba(29, 155, 240, 0.9)';
  button.style.color = 'white';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  button.style.fontSize = '12px';
  button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  
  button.addEventListener('click', async (e) => {
    e.stopPropagation();
    const selectedText = selection.toString().trim();
    // 使用现有的 translateText 功能翻译所选内容
    await translateSelectedText(selectedText, button);
  });
  
  document.body.appendChild(button);
  debugLog('翻译按钮已添加到页面');
  
  // 自动隐藏浮动按钮
  document.addEventListener('click', function hideFloatingButton(e) {
    if (e.target !== button && !button.contains(e.target)) {
      removeExistingFloatingButton();
      document.removeEventListener('click', hideFloatingButton);
    }
  });
}

// 清除已存在的浮动按钮
function removeExistingFloatingButton() {
  const existingButton = document.querySelector('.floating-translate-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  const existingResult = document.querySelector('.translation-result-popup');
  if (existingResult) {
    existingResult.remove();
  }
}

// 翻译选中的文本并显示结果
async function translateSelectedText(text, buttonElement) {
  try {
    // 显示加载状态
    if (buttonElement) {
      buttonElement.innerHTML = '翻译中...';
      buttonElement.style.cursor = 'wait';
    }
    
    // 获取 API 设置
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['activeAiProvider', 'deepseekApiKey', 'kimiApiKey', 'openaiApiKey', 'translationEnabled', 'flomoApi'], resolve);
    });
    
    const activeAi = settings.activeAiProvider || 'deepseek';
    const apiKey = settings[activeAi + 'ApiKey'] || '';
    const translationEnabled = settings.translationEnabled !== false;
    const flomoApiEndpoint = settings.flomoApi || ''; // 修改这里：使用flomoApi键名
    
    if (!apiKey && activeAi !== 'google-free') {
      showToast('请先在插件设置中配置 API 密钥');
      removeExistingFloatingButton();
      return;
    }
    
    if (!translationEnabled) {
      showToast('翻译功能当前已暂停，请在设置中启用');
      removeExistingFloatingButton();
      return;
    }
    
    // 根据AI提供商选择翻译方法
    let translated;
    if (activeAi === 'google-free') {
      try {
        const googleTranslator = new GoogleFreeTranslator();
        translated = await googleTranslator.translate(text, 'zh-CN');
      } catch (error) {
        console.error('Google免费翻译失败:', error);
        showToast('Google翻译失败: ' + error.message);
        removeExistingFloatingButton();
        return;
      }
    } else {
      // 使用API翻译
      translated = await translateText(text, apiKey, activeAi);
    }
    
    // 移除按钮
    removeExistingFloatingButton();
    
    // 创建翻译结果弹窗
    showTranslationResult(text, translated, activeAi, flomoApiEndpoint);
    
  } catch (error) {
    console.error('Translation failed:', error);
    showToast(`翻译失败: ${error.message || '未知错误'}`);
    removeExistingFloatingButton();
  }
}

// 显示翻译结果
function showTranslationResult(originalText, translatedText, aiProvider, flomoApiEndpoint) {
  debugLog('显示翻译结果:', originalText, translatedText);
  
  // 如果有已存在的结果弹窗，先移除
  const existingResult = document.querySelector('.translation-result-popup');
  if (existingResult) {
    existingResult.remove();
  }
  
  // 获取当前选中位置
  let rect;
  const selection = window.getSelection();
  if (selection.rangeCount) {
    rect = selection.getRangeAt(0).getBoundingClientRect();
  } else {
    // 如果没有选中内容，就在页面中央显示
    rect = {
      left: window.innerWidth / 2 - 175,
      bottom: window.innerHeight / 2
    };
  }
  
  const resultPopup = document.createElement('div');
  resultPopup.className = 'translation-result-popup';
  resultPopup.style.position = 'absolute';
  resultPopup.style.top = `${window.scrollY + rect.bottom + 5}px`;
  resultPopup.style.left = `${window.scrollX + rect.left}px`;
  resultPopup.style.zIndex = '10000';
  resultPopup.style.padding = '15px';
  resultPopup.style.backgroundColor = 'white';
  resultPopup.style.border = '1px solid #ccc';
  resultPopup.style.borderRadius = '5px';
  resultPopup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  resultPopup.style.maxWidth = '350px';
  resultPopup.style.width = 'auto';
  
  // 显示提供商名称
  const providerName = aiProvider === 'google-free' ? 'Google翻译' : 
                      aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1);
  
  resultPopup.innerHTML = `
    <div style="margin-bottom: 6px; font-weight: bold; font-size: 12px; color: #8E8E93;">原文</div>
    <div style="margin-bottom: 12px;">${originalText}</div>
    <div style="margin-bottom: 6px; font-weight: bold; font-size: 12px; color: #8E8E93;">${providerName} 翻译</div>
    <div>${translatedText}</div>
    <div style="display: flex; justify-content: space-between; margin-top: 12px;">
      <button class="translation-action-button" id="highlight-btn" style="padding: 5px 10px; border: none; border-radius: 4px; background: #f0f0f0; cursor: pointer;">高亮保存</button>
      ${flomoApiEndpoint ? '<button class="translation-action-button" id="flomo-btn" style="padding: 5px 10px; border: none; border-radius: 4px; background: #f0f0f0; cursor: pointer;">保存到Flomo</button>' : ''}
      <button class="translation-action-button" id="close-btn" style="padding: 5px 10px; border: none; border-radius: 4px; background: #f0f0f0; cursor: pointer;">关闭</button>
    </div>
  `;
  
  document.body.appendChild(resultPopup);
  debugLog('翻译结果已添加到页面');
  
  // 事件处理
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      resultPopup.remove();
    });
  }
  
  const highlightBtn = document.getElementById('highlight-btn');
  if (highlightBtn) {
    highlightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // 使用现有的单词高亮功能
      addToHighlightedWords(originalText, translatedText);
      resultPopup.remove();
      showToast('已添加到高亮单词列表');
    });
  }
  
  // 如果有Flomo API端点，添加保存到Flomo的功能
  const flomoBtn = document.getElementById('flomo-btn');
  if (flomoBtn) {
    flomoBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      if (!flomoApiEndpoint) {
        showToast('请在侧栏设置中绑定 Flomo API 端点');
        return;
      }

      debugLog('尝试保存到Flomo, API地址:', flomoApiEndpoint); // 调试信息

      try {
        showToast('正在保存到 Flomo...');
        // 通过background.js中转请求以避免CORS问题
        chrome.runtime.sendMessage({
          action: "saveToFlomo",
          flomoApi: flomoApiEndpoint,
          content: `${originalText}\n${translatedText} #flomo ${window.location.href}`
        }, response => {
          if (response && response.success) {
            showToast('成功保存到 Flomo！');
            resultPopup.remove();
          } else {
            const errorMsg = response ? response.error : '未知错误';
            showToast(`保存失败：${errorMsg}`);
            console.error('Failed to save to Flomo:', errorMsg);
          }
        });
      } catch (error) {
        console.error('Failed to save to Flomo:', error);
        showToast(`保存失败：${error.message || '请检查 Flomo API 端点'}`);
      }
    });
  }
  
  // 点击外部关闭
  document.addEventListener('click', function closeResultPopup(e) {
    if (e.target !== resultPopup && !resultPopup.contains(e.target)) {
      resultPopup.remove();
      document.removeEventListener('click', closeResultPopup);
    }
  });
}

// 添加到高亮单词列表
function addToHighlightedWords(word, translation) {
  chrome.storage.sync.get(['highlightedWords', 'wordData'], (result) => {
    let highlightedWords = result.highlightedWords || [];
    let wordData = result.wordData || {};
    
    if (!highlightedWords.includes(word)) {
      highlightedWords.push(word);
      wordData[word] = {
        word: word,
        translation: translation,
        phonetics: '',
        tweetOriginal: '',
        tweetTranslated: '',
        examples: []
      };
      
      chrome.storage.sync.set({ 
        highlightedWords: highlightedWords,
        wordData: wordData
      }, () => {
        debugLog('Word added to highlights:', word);
        // 通知更新侧栏
        chrome.runtime.sendMessage({ action: "updateSidebar" });
      });
    } else {
      showToast('该内容已在高亮列表中');
    }
  });
}

// ============== 增强版的文本选择事件监听 ==============

// 设置文本选择监听器
function setupSelectionListener() {
  debugLog('设置文本选择监听器');
  
  document.addEventListener('mouseup', function(e) {
    debugLog('捕获到鼠标释放事件');
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      debugLog('选中的文本:', selectedText);
      debugLog('当前网址:', window.location.href);
      
      if (selectedText && selectedText.length > 1 && 
          !window.location.href.includes('https://x.com/') && 
          !window.location.href.includes('https://twitter.com/')) {
        debugLog('显示翻译按钮');
        createFloatingTranslateButton(selection);
      }
    }, 10); // 小延迟确保选择已完成
  });
}

// 处理来自右键菜单的翻译请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "translateSelectedText") {
    debugLog('收到右键菜单翻译请求:', message.text);
    const selectedText = message.text;
    translateSelectedText(selectedText);
    sendResponse({success: true});
    return true;
  }
  return false;
});

// ===========================================================

// 初始化函数 - 修改后默认不显示功能按钮
function initialize() {
  debugLog("初始化X.com翻译助手...");
  
  if (window.location.href.includes('x.com') || window.location.href.includes('twitter.com')) {
    debugLog("检测到X.com页面，启动特定功能");
    
    // 清理可能存在的重复按钮
    cleanupDuplicateButtons();
    
    // 立即添加第一批翻译按钮
    addTranslationButtons(true);
    
    // 设置增强的事件监听
    setupScrollDetection();
    setupURLChangeDetection();
    setupDOMObserver();
    
    // 默认不添加功能按钮 (已移除这两行)
    // addScanButton();
    // addEmergencyFixButton();
    
    // 定期全面扫描，但降低频率避免过度扫描
    setInterval(() => {
      debugLog("执行定期全面扫描");
      addTranslationButtons(true);
    }, 15000); // 每15秒扫描一次
    
    // 定期清理重复按钮
    setInterval(() => {
      cleanupDuplicateButtons();
      cleanupErrorMessages();
    }, 10000); // 每10秒清理一次
    
    // 在关键事件发生时重新扫描
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        debugLog("页面重新变为可见，扫描推文");
        cleanupDuplicateButtons();
        addTranslationButtons(true);
      }
    });
    
    // 专门处理详情页，但使用更合理的间隔
    if (window.location.href.includes('/status/')) {
      debugLog("检测到详情页面，应用特殊处理");
      // 多次尝试扫描详情页主推文
      const intervals = [800, 1500, 3000, 6000];
      intervals.forEach(delay => {
        setTimeout(() => {
          debugLog(`延时${delay}ms扫描详情页主推文`);
          addTranslationButtons(true);
        }, delay);
      });
    }
  } else {
    // 非X.com页面，只设置文本选择翻译
    debugLog("非X.com页面，启用通用翻译功能");
    setupSelectionListener();
  }
}

// 文档加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// 页面完全加载后再次检查
window.addEventListener('load', () => {
  if (window.location.href.includes('https://x.com/') || window.location.href.includes('https://twitter.com/')) {
    debugLog("页面完全加载后再次检查X.com翻译按钮");
    cleanupDuplicateButtons();
    addTranslationButtons(true);
  }
});

// 监听窗口焦点变化，当用户回到页面时添加新的翻译按钮
window.addEventListener('focus', () => {
  if (window.location.href.includes('https://x.com/') || window.location.href.includes('https://twitter.com/')) {
    debugLog("用户回到页面，检查新的翻译按钮");
    cleanupDuplicateButtons();
    addTranslationButtons(true);
  }
});

// 添加键盘快捷键进行诊断和显示功能按钮
document.addEventListener('keydown', (e) => {
  // Alt+Shift+T 触发页面诊断
  if (e.altKey && e.shiftKey && e.key === 'T') {
    debugLog('======== X.com翻译扩展诊断 ========');
    debugLog(`页面URL: ${window.location.href}`);
    debugLog(`是否为详情页: ${window.location.href.includes('/status/') ? '是' : '否'}`);
    debugLog(`执行扫描次数: ${performanceStats.scansPerformed}`);
    debugLog(`添加按钮总数: ${performanceStats.buttonsAdded}`);
    debugLog(`上次扫描时间: ${new Date(performanceStats.lastScanTime).toLocaleTimeString()}`);
    debugLog(`当前页面翻译按钮数: ${document.querySelectorAll('.translate-button').length}`);
    debugLog(`当前页面错误按钮数: ${document.querySelectorAll('.translate-button-error').length}`);
    debugLog(`当前页面已翻译结果数: ${document.querySelectorAll('.translated-text').length}`);
    
    debugLog('执行紧急诊断和修复...');
    cleanupDuplicateButtons();
    addTranslationButtons(true);
    
    showToast('诊断完成，请查看控制台日志');
  }
  
  // 新增：Alt+Shift+B 临时显示功能按钮
  if (e.altKey && e.shiftKey && e.key === 'B') {
    // 显示按钮
    if (!document.querySelector('#manual-scan-button')) {
      addScanButton();
      showToast('扫描按钮已显示，15秒后自动隐藏');
      
      // 15秒后自动隐藏
      setTimeout(() => {
        const scanButton = document.querySelector('#manual-scan-button');
        if (scanButton) scanButton.remove();
      }, 15000);
    }
    
    if (!document.querySelector('#emergency-fix-button')) {
      addEmergencyFixButton();
      
      // 15秒后自动隐藏
      setTimeout(() => {
        const fixButton = document.querySelector('#emergency-fix-button');
        if (fixButton) fixButton.remove();
      }, 15000);
    }
  }
});

// 添加翻译按钮和已翻译文本的样式
const style = document.createElement('style');
style.textContent = `
  .translate-button {
    display: inline-block;
    margin-left: 8px;
    padding: 2px 8px;
    background-color: rgba(29, 155, 240, 0.1);
    color: rgb(29, 155, 240);
    border: 1px solid rgb(29, 155, 240);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .translate-button:hover {
    background-color: rgba(29, 155, 240, 0.2);
  }
  
  .translate-button-loading {
    opacity: 0.7;
    cursor: wait;
  }
  
  .translate-button-error {
    background-color: rgba(220, 53, 69, 0.1);
    color: rgb(220, 53, 69);
    border-color: rgb(220, 53, 69);
  }
  
  .translated-text {
    margin-top: 8px;
    padding: 8px;
    background-color: rgba(29, 155, 240, 0.05);
    border-left: 3px solid rgb(29, 155, 240);
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.4;
  }
  
  .save-to-flomo-button {
    margin-top: 8px;
    padding: 3px 8px;
    background-color: #5bc8af;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  
  .save-to-flomo-button:hover {
    background-color: #4aa899;
  }
  
  .tweet-translator-toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 10000;
    font-size: 14px;
    transition: opacity 0.3s ease;
  }
  
  .floating-translate-button {
    background-color: rgba(29, 155, 240, 0.9);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }
  
  .floating-translate-button:hover {
    background-color: rgba(29, 155, 240, 1);
  }
  
  .translation-result-popup {
    background-color: white;
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    max-width: 350px;
    width: auto;
    z-index: 10000;
  }
  
  .translation-action-button {
    padding: 5px 10px;
    background-color: #f0f0f0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .translation-action-button:hover {
    background-color: #e0e0e0;
  }
  
  #manual-scan-button, #emergency-fix-button {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
`;

document.head.appendChild(style);