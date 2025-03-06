// 通用网页划词翻译 - 优化版
console.log("通用网页划词翻译独立版已启动");

// 避免重复初始化
if (window.generalTranslateInitialized) {
  console.log("通用划词翻译已经初始化，跳过");
} else {
  window.generalTranslateInitialized = true;
  
  // 主初始化
  initializeTranslation();
}

// 主初始化函数
function initializeTranslation() {
  console.log("初始化通用划词翻译功能...");
  
  // 主要事件监听器 - 划词触发
  document.addEventListener('mouseup', handleTextSelection);
  
  // 监听来自右键菜单的请求
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "translateSelectedText") {
      console.log('收到右键菜单翻译请求:', message.text);
      if (message.text) {
        translateSelectedText(message.text);
        sendResponse({success: true});
      } else {
        sendResponse({success: false, error: "没有选中文本"});
      }
      return true;
    }
    return false;
  });
  
  console.log("通用划词翻译功能初始化完成");
}

// 处理文本选择
function handleTextSelection(e) {
  // 只响应左键
  if (e.button !== 0) return;
  
  try {
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      if (selectedText) {
        console.log('检测到选中文本:', selectedText);
        
        // 获取选区位置
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // 显示翻译按钮在选区附近
          showTranslateButton(
            window.scrollX + rect.left, 
            window.scrollY + rect.bottom + 5,
            selectedText
          );
        }
      }
    }, 10); // 小延迟确保选择完成
  } catch (error) {
    console.error('处理文本选择出错:', error);
  }
}

// 显示翻译按钮
function showTranslateButton(x, y, text) {
  // 移除已存在的按钮和结果
  removeElements();
  
  try {
    // 创建按钮
    const button = document.createElement('div');
    button.id = 'gt-translate-button';
    button.className = 'gt-translate-button';
    button.textContent = '翻译';
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    
    // 点击翻译
    button.addEventListener('click', () => {
      console.log('点击翻译按钮，文本:', text);
      translateSelectedText(text);
    });
    
    // 添加到页面
    document.body.appendChild(button);
    
    // 点击其他区域隐藏按钮
    setTimeout(() => {
      document.addEventListener('mousedown', function hideOnClick(e) {
        if (e.target !== button) {
          button.remove();
          document.removeEventListener('mousedown', hideOnClick);
        }
      });
    }, 10);
  } catch (error) {
    console.error('显示翻译按钮出错:', error);
    showToast('显示翻译按钮失败: ' + error.message);
  }
}

// 移除已存在的元素
function removeElements() {
  const button = document.getElementById('gt-translate-button');
  if (button) button.remove();
  
  const result = document.getElementById('gt-translate-result');
  if (result) result.remove();
}

// 翻译选中文本
async function translateSelectedText(text) {
  if (!text) {
    showToast('没有选中文本');
    return;
  }
  
  removeElements();
  showToast('正在翻译...');
  
  try {
    // 1. 获取API设置
    console.log('正在获取API设置...');
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(
        ['activeAiProvider', 'deepseekApiKey', 'kimiApiKey', 'openaiApiKey', 'translationEnabled', 'flomoApi'], 
        (result) => {
          console.log('获取到存储设置:', Object.keys(result).join(', '));
          result.flomoApiEndpoint = result.flomoApi; // 将flomoApi映射到flomoApiEndpoint
          resolve(result);
        }
      );
    });
    
    // 2. 验证设置
    const activeAi = settings.activeAiProvider || 'deepseek';
    const apiKey = settings[activeAi + 'ApiKey'] || '';
    const translationEnabled = settings.translationEnabled !== false;
    const flomoApiEndpoint = settings.flomoApiEndpoint || '';
    
    console.log(`使用AI提供商: ${activeAi}, API密钥长度: ${apiKey ? apiKey.length : 0}, 翻译功能状态: ${translationEnabled ? '启用' : '禁用'}`);
    console.log('Flomo API:', flomoApiEndpoint);
    
    if (!apiKey) {
      showToast('请先在插件设置中配置API密钥');
      return;
    }
    
    if (!translationEnabled) {
      showToast('翻译功能已暂停，请在设置中启用');
      return;
    }
    
    // 3. 执行翻译
    console.log('开始翻译文本...');
    const translatedText = await callTranslationApi(text, apiKey, activeAi);
    console.log('翻译完成:', translatedText.slice(0, 50) + '...');
    
    // 4. 显示结果
    displayTranslationResult(text, translatedText, activeAi, flomoApiEndpoint);
    
  } catch (error) {
    console.error('翻译过程出错:', error);
    showToast(`翻译失败: ${error.message || '未知错误'}`);
  }
}

// 调用翻译API
async function callTranslationApi(text, apiKey, aiProvider) {
  console.log(`使用${aiProvider}调用翻译API...`);
  
  // 确定API端点和模型
  const apiUrl = aiProvider === 'deepseek' 
    ? 'https://api.deepseek.com/chat/completions' 
    : aiProvider === 'kimi'
    ? 'https://api.moonshot.cn/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
    
  const model = aiProvider === 'deepseek' ? 'deepseek-chat' : 
               aiProvider === 'kimi' ? 'moonshot-v1-8k' : 
               'gpt-3.5-turbo';
  
  // 设置超时
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
  
  try {
    // 发送请求
    console.log(`发送请求到${apiUrl}...`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { 
            "role": "system", 
            "content": "You are a concise translator. Translate the following text into Chinese if it's English or another language, keeping it brief and accurate. If the text is already in Chinese, translate it to English." 
          },
          { "role": "user", "content": text }
        ],
        stream: false,
        max_tokens: 1000
      }),
      signal: controller.signal
    });
    
    // 清除超时
    clearTimeout(timeoutId);
    
    // 检查响应
    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法获取错误详情');
      console.error(`API响应错误 (${response.status}):`, errorText);
      throw new Error(`API请求失败 (${response.status}): ${response.statusText}`);
    }
    
    // 解析响应
    const data = await response.json();
    console.log('API响应:', data);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('API响应格式异常:', data);
      throw new Error('API响应格式异常');
    }
    
    return data.choices[0].message.content.trim();
    
  } catch (error) {
    console.error('API调用错误:', error);
    
    if (error.name === 'AbortError') {
      throw new Error('翻译请求超时，请检查网络连接');
    }
    
    if (error.message.includes('Failed to fetch')) {
      throw new Error('网络请求失败，请检查网络连接和API地址');
    }
    
    throw error;
  }
}

// 显示翻译结果
function displayTranslationResult(originalText, translatedText, aiProvider, flomoApiEndpoint) {
  try {
    // 创建结果容器
    const resultContainer = document.createElement('div');
    resultContainer.id = 'gt-translate-result';
    resultContainer.className = 'gt-translate-result';
    resultContainer.style.top = '50px';
    resultContainer.style.right = '20px';
    
    // 填充内容
    resultContainer.innerHTML = `
      <div class="header">
        <span style="font-weight: bold;">翻译结果</span>
        <button class="close-btn" id="gt-close-result">×</button>
      </div>
      <div class="content">
        <div class="section">
          <div class="label">原文</div>
          <div class="text">${originalText}</div>
        </div>
        <div class="section">
          <div class="label">${aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)} 翻译</div>
          <div class="text">${translatedText}</div>
        </div>
        <div class="actions">
          <button id="gt-copy-result">复制翻译结果</button>
          ${flomoApiEndpoint ? `<button id="gt-save-to-flomo">保存到Flomo</button>` : ''}
        </div>
      </div>
    `;
    
    // 添加到页面
    document.body.appendChild(resultContainer);
    
    // 绑定事件
    document.getElementById('gt-close-result').addEventListener('click', () => {
      resultContainer.remove();
    });
    
    document.getElementById('gt-copy-result').addEventListener('click', () => {
      navigator.clipboard.writeText(`${originalText}\n\n${translatedText}`)
        .then(() => showToast('已复制原文和翻译结果'))
        .catch(err => {
          console.error('复制失败:', err);
          showToast('复制失败: ' + err.message);
        });
    });
    
    // Flomo保存功能
    if (flomoApiEndpoint) {
      document.getElementById('gt-save-to-flomo').addEventListener('click', async () => {
        console.log('尝试保存到Flomo, API地址:', flomoApiEndpoint); // 调试信息
        
        try {
          showToast('正在保存到Flomo...');
          
          // 使用background.js中转请求
          chrome.runtime.sendMessage({
            action: "saveToFlomo",
            flomoApi: flomoApiEndpoint,
            content: `${originalText}\n\n${translatedText} #翻译 ${window.location.href}`
          }, response => {
            if (response && response.success) {
              showToast('已成功保存到Flomo！');
            } else {
              const errorMsg = response ? response.error : '未知错误';
              showToast(`保存失败：${errorMsg}`);
              console.error('保存到Flomo失败:', errorMsg);
            }
          });
        } catch (error) {
          console.error('保存到Flomo失败:', error);
          showToast('保存到Flomo失败: ' + error.message);
        }
      });
    }
    
    // 点击外部关闭
    document.addEventListener('click', function closeResult(e) {
      const result = document.getElementById('gt-translate-result');
      if (result && !result.contains(e.target) && e.target.id !== 'gt-translate-button') {
        result.remove();
        document.removeEventListener('click', closeResult);
      }
    });
    
  } catch (error) {
    console.error('显示翻译结果出错:', error);
    showToast('显示翻译结果失败: ' + error.message);
  }
}

// 显示提示消息
function showToast(message) {
  try {
    // 移除已存在的提示
    let toast = document.getElementById('gt-toast');
    if (toast) toast.remove();
    
    // 创建新提示
    toast = document.createElement('div');
    toast.id = 'gt-toast';
    toast.className = 'gt-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // 显示提示
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }, 10);
    
  } catch (error) {
    console.error('显示提示消息出错:', error);
  }
}

// 打印调试信息
console.log("通用划词翻译脚本已完全加载");