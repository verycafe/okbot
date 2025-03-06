// 在扩展安装或更新时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translateSelection",
    title: "翻译所选内容",
    contexts: ["selection"]
  });
  console.log('已创建右键菜单: 翻译所选内容');
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelection") {
    console.log('右键菜单翻译被点击，选中文本:', info.selectionText);
    chrome.tabs.sendMessage(tab.id, {
      action: "translateSelectedText",
      text: info.selectionText
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('发送翻译请求失败:', chrome.runtime.lastError.message);
        // 尝试重试三次，每次间隔 100ms
        sendWithRetry(tab.id, { 
          action: "translateSelectedText", 
          text: info.selectionText 
        }, 3, 100);
      } else {
        console.log('成功发送翻译请求');
      }
    });
  }
});

// 监听插件图标点击
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id || !tab.url) {
    console.error('无效的tab对象:', tab);
    return;
  }

  console.log('尝试在页面ID为', tab.id, '的页面上展开侧栏'); // 调试日志

  // 统一使用toggleSidebar消息以匹配slider.js的监听器
  chrome.tabs.sendMessage(tab.id, { action: "toggleSidebar" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('发送消息失败:', chrome.runtime.lastError.message);
      // 尝试重试三次，每次间隔 100ms
      sendWithRetry(tab.id, { action: "toggleSidebar" }, 3, 100);
    } else if (response && !response.success) {
      console.error('展开侧栏失败:', response.error);
      showToast(`展开侧栏失败：${response.error || '未知错误'}`);
    } else {
      console.log('成功发送消息以展开侧栏');
    }
  });

  // 确保侧栏检查
  chrome.tabs.sendMessage(tab.id, { action: "checkSidebar" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Sidebar check failed:', chrome.runtime.lastError.message);
      sendWithRetry(tab.id, { action: "checkSidebar" }, 3, 100);
    } else if (response && !response.success) {
      console.error('Sidebar check failed:', response.error);
      showToast(`侧栏检查失败：${response.error || '未知错误'}`);
    } else {
      console.log('成功检查侧栏');
    }
  });
});

// 处理Flomo请求 - 添加这部分代码
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveToFlomo") {
    console.log("收到保存到Flomo请求", message.flomoApi);
    
    fetch(message.flomoApi, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message.content
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Status: ${response.status}`);
      }
      return response.text();
    })
    .then(data => {
      console.log("Flomo API成功响应:", data);
      sendResponse({ success: true, data: data });
    })
    .catch(error => {
      console.error('保存到Flomo失败:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // 保持消息通道开放，等待异步响应
  }
});

// Helper function to send message with retry
function sendWithRetry(tabId, message, maxRetries, delay) {
  let attempts = 0;

  function sendMessage() {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        attempts++;
        const errorMsg = chrome.runtime.lastError.message;
        console.error(`Attempt ${attempts} failed to send message: ${errorMsg}`);
        if (attempts < maxRetries) {
          console.log(`Retrying in ${delay}ms...`);
          setTimeout(sendMessage, delay);
        } else {
          console.error(`Max retries (${maxRetries}) reached, giving up.`);
          showToast(`侧栏操作失败：${errorMsg || '多次尝试后仍失败，请刷新页面或检查扩展权限'}`);
        }
      } else if (response && !response.success) {
        console.error('Message failed:', response.error);
        showToast(`侧栏操作失败：${response.error || '未知错误'}`);
      } else {
        console.log(`Successfully sent message: ${JSON.stringify(message)}`);
      }
    });
  }

  sendMessage();
}

// Show toast notification (for background.js)
function showToast(message) {
  chrome.runtime.sendMessage({ action: "showToast", message: message });
}