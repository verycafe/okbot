// 初始化AI聊天助手
let aiChat;

// 存储网页上下文
let pageContext = null;

// 存储当前活动的AI提供商显示名称
let currentAiProvider = 'AI';

// AI提供商友好显示名称映射
const providerDisplayNames = {
  'deepseek': 'DeepSeek',
  'kimi': 'KIMI',
  'openai': 'OpenAI'
};

// 创建侧边栏
function createSlider() {
  const slider = document.createElement('div');
  slider.className = 'word-slider';
  
  // 添加选项卡和内容
  slider.innerHTML = `
    <div class="sidebar-header">
      <h2 class="sidebar-title">翻译助手</h2>
      <button class="collapse-btn">×</button>
    </div>
    
    <!-- 选项卡导航 -->
    <div class="tab-navigation">
      <button class="tab-button active" data-tab="settings">设置</button>
      <button class="tab-button" data-tab="flomo">Flomo</button>
      <button class="tab-button" data-tab="assistant">助手</button>
    </div>
    
    <!-- 选项卡内容 -->
    <div class="tab-content">
      <!-- 设置选项卡 -->
      <div class="tab-pane active" id="settings-tab">
        <label>
          AI 选择：
          <select id="aiProviderInSidebar">
            <option value="deepseek">DeepSeek</option>
            <option value="kimi">Kimi</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label>
          API 密钥：
          <input type="text" id="apiKeyInSidebar" placeholder="输入API密钥" autocomplete="new-password" class="password-field">
        </label>
        <button id="saveInSidebar">保存</button>
        <button id="toggleTranslationInSidebar">暂停翻译</button>
        <div id="statusInSidebar"></div>
      </div>
      
      <!-- Flomo选项卡 -->
      <div class="tab-pane" id="flomo-tab">
        <div class="flomo-section">
          <h3>Flomo设置</h3>
          <label>
            Flomo API:
            <input type="text" id="flomoApiInSidebar" placeholder="输入Flomo API">
          </label>
          <button id="saveFlomoApiInSidebar">保存</button>
        </div>
      </div>
      
      <!-- 助手选项卡 -->
      <div class="tab-pane" id="assistant-tab">
        <!-- 网页总结部分 -->
        <div class="summary-section">
          <h3>网页内容总结</h3>
          <button id="summarizePageBtn" class="action-button">总结当前页面</button>
          <div id="pageSummary" class="summary-content"></div>
        </div>
        
        <!-- 聊天问答部分 -->
        <div class="chat-section">
          <h3>基于页面内容的问答</h3>
          <div id="chatMessages" class="chat-messages"></div>
          <div class="chat-input">
            <input type="text" id="chatInput" placeholder="输入问题...">
            <button id="sendMessageBtn">发送</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(slider);
  
  // 初始化事件监听器
  initSidebar();
  
  return slider;
}

// 初始化侧边栏
function initSidebar() {
  // 初始化选项卡切换
  initTabNavigation();
  
  // 初始化关闭按钮
  document.querySelector('.collapse-btn').addEventListener('click', () => {
    document.querySelector('.word-slider').classList.remove('active');
  });
  
  // 初始化设置
  initSettings();
  
  // 初始化Flomo相关功能
  initFlomoFeatures();
  
  // 初始化助手功能
  initAssistantFeatures();
}

// 初始化选项卡切换
function initTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      // 移除所有active类
      tabButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
      
      // 添加active类到当前按钮
      this.classList.add('active');
      
      // 显示对应内容
      const tabId = this.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// 初始化设置
function initSettings() {
  // 加载API设置
  chrome.storage.sync.get(['deepseekApiKey', 'kimiApiKey', 'openaiApiKey', 'activeAiProvider', 'translationEnabled'], (result) => {
    const aiProvider = document.getElementById('aiProviderInSidebar');
    const apiKeyInput = document.getElementById('apiKeyInSidebar');
    const toggleButton = document.getElementById('toggleTranslationInSidebar');
    
    // 设置当前选择的AI
    const activeAi = result.activeAiProvider || 'deepseek';
    aiProvider.value = activeAi;
    
    // 更新当前AI提供商显示名称
    currentAiProvider = providerDisplayNames[activeAi] || activeAi.toUpperCase();
    
    // 加载对应API密钥
    const apiKey = result[activeAi + 'ApiKey'] || '';
    apiKeyInput.value = apiKey;
    
    // 初始化翻译状态
    const isEnabled = result.translationEnabled !== false; // 默认启用
    toggleButton.textContent = isEnabled ? '暂停翻译' : '取消暂停翻译';
    toggleButton.classList.toggle('active', isEnabled);
    
    // 监听AI选择变化
    aiProvider.addEventListener('change', () => {
      const selectedProvider = aiProvider.value;
      chrome.storage.sync.get([selectedProvider + 'ApiKey'], (result) => {
        apiKeyInput.value = result[selectedProvider + 'ApiKey'] || '';
      });
    });
    
    // 保存API设置
    document.getElementById('saveInSidebar').addEventListener('click', () => {
      const selectedProvider = aiProvider.value;
      const apiKey = apiKeyInput.value.trim();
      
      if (apiKey) {
        chrome.storage.sync.set({ 
          [selectedProvider + 'ApiKey']: apiKey,
          activeAiProvider: selectedProvider 
        }, () => {
          // 更新当前AI提供商显示名称
          currentAiProvider = providerDisplayNames[selectedProvider] || selectedProvider.toUpperCase();
          
          document.getElementById('statusInSidebar').textContent = 'API密钥已保存！';
          setTimeout(() => {
            document.getElementById('statusInSidebar').textContent = '';
          }, 2000);
          
          // 初始化或更新AI聊天助手
          initAIChat();
        });
      } else {
        alert('请输入有效的API密钥！');
      }
    });
    
    // 切换翻译状态
    toggleButton.addEventListener('click', () => {
      chrome.storage.sync.get(['translationEnabled'], (result) => {
        const isEnabled = result.translationEnabled !== false; // 默认启用
        const newEnabled = !isEnabled;
        
        chrome.storage.sync.set({ translationEnabled: newEnabled }, () => {
          toggleButton.textContent = newEnabled ? '暂停翻译' : '取消暂停翻译';
          toggleButton.classList.toggle('active', newEnabled);
          
          document.getElementById('statusInSidebar').textContent = newEnabled ? '翻译已启用' : '翻译已暂停';
          setTimeout(() => {
            document.getElementById('statusInSidebar').textContent = '';
          }, 2000);
        });
      });
    });
    
    // 初始化AI聊天助手
    initAIChat();
  });
}

// 初始化Flomo相关功能
function initFlomoFeatures() {
  // 加载Flomo API
  chrome.storage.sync.get(['flomoApi'], (result) => {
    const flomoApiInput = document.getElementById('flomoApiInSidebar');
    flomoApiInput.value = result.flomoApi || '';
    
    // 保存Flomo API
    document.getElementById('saveFlomoApiInSidebar').addEventListener('click', () => {
      const flomoApi = flomoApiInput.value.trim();
      
      chrome.storage.sync.set({ flomoApi }, () => {
        document.getElementById('statusInSidebar').textContent = 'Flomo API已保存！';
        setTimeout(() => {
          document.getElementById('statusInSidebar').textContent = '';
        }, 2000);
      });
    });
  });
}

// 初始化助手功能
function initAssistantFeatures() {
  // 总结页面按钮
  document.getElementById('summarizePageBtn').addEventListener('click', summarizePage);
  
  // 发送聊天消息按钮
  document.getElementById('sendMessageBtn').addEventListener('click', sendChatMessage);
  
  // 绑定回车键发送消息
  document.getElementById('chatInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });
}

// 初始化AI聊天助手
function initAIChat() {
  chrome.storage.sync.get(['activeAiProvider', 'deepseekApiKey', 'kimiApiKey', 'openaiApiKey'], (result) => {
    const provider = result.activeAiProvider || 'deepseek';
    const apiKey = result[provider + 'ApiKey'] || '';
    
    // 更新当前AI提供商显示名称
    currentAiProvider = providerDisplayNames[provider] || provider.toUpperCase();
    
    if (!aiChat) {
      aiChat = new AIChat();
    }
    
    if (apiKey) {
      aiChat.setApiConfig(provider, apiKey);
    } else {
      // 在聊天区域显示提示
      addMessageToChat('system', `请先在设置中配置${providerDisplayNames[provider] || provider.toUpperCase()} API密钥`);
    }
  });
}

// 总结网页内容
async function summarizePage() {
  // 确保AI聊天助手已初始化
  if (!aiChat || !aiChat.apiKey) {
    addMessageToChat('system', '请先在设置中配置API密钥');
    return;
  }
  
  const summaryContainer = document.getElementById('pageSummary');
  summaryContainer.innerHTML = '<div class="loading-indicator">正在总结网页内容...</div>';
  
  try {
    // 获取网页内容
    const pageContent = document.body.innerText;
    
    // 截取合适长度的内容
    const truncatedContent = pageContent.slice(0, 3000) + 
      (pageContent.length > 3000 ? "\n\n[内容已截断，仅显示前3000字符]" : "");
    
    // 存储为上下文，供聊天功能使用
    pageContext = truncatedContent;
    
    // 设置系统提示为总结专家
    aiChat.setSystemPrompt("你是一个网页内容总结专家。请简洁总结以下网页内容的主要信息，使用要点形式。");
    
    // 发送到API进行总结
    const summary = await aiChat.sendMessage("请总结以下网页内容:\n\n" + truncatedContent);
    
    // 显示总结结果
    summaryContainer.innerHTML = summary;
    
    // 重置对话历史，准备开始新的对话
    aiChat.resetConversation();
    
    // 重置系统提示为基于网页内容的问答
    aiChat.setSystemPrompt("你是一个助手，负责基于网页内容回答问题。请提供简洁、准确的回答。");
    
    // 添加一个系统消息到聊天
    addMessageToChat('system', '网页内容已总结，您可以开始提问了');
  } catch (error) {
    summaryContainer.innerHTML = "获取总结失败: " + error.message;
    console.error("总结页面失败:", error);
  }
}

// 发送聊天消息
async function sendChatMessage() {
  // 确保AI聊天助手已初始化
  if (!aiChat || !aiChat.apiKey) {
    addMessageToChat('system', '请先在设置中配置API密钥');
    return;
  }
  
  const input = document.getElementById('chatInput').value.trim();
  if (!input) return;
  
  // 清空输入框
  document.getElementById('chatInput').value = '';
  
  // 添加用户消息到UI
  addMessageToChat('user', input);
  
  // 如果还没有页面上下文，获取一部分
  if (!pageContext) {
    const pageContent = document.body.innerText;
    pageContext = pageContent.slice(0, 3000);
  }
  
  // 显示正在输入指示器
  const chatContainer = document.getElementById('chatMessages');
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-message system-message';
  loadingDiv.innerHTML = '<div class="loading-indicator">AI正在思考...</div>';
  chatContainer.appendChild(loadingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  
  try {
    // 发送消息到API
    const response = await aiChat.sendMessage(input, pageContext);
    
    // 移除加载指示器
    chatContainer.removeChild(loadingDiv);
    
    // 添加助手回复到UI
    addMessageToChat('assistant', response);
  } catch (error) {
    // 移除加载指示器
    chatContainer.removeChild(loadingDiv);
    
    // 显示错误消息
    addMessageToChat('system', "发送失败: " + error.message);
    console.error("发送消息失败:", error);
  }
}

// 添加消息到聊天UI
function addMessageToChat(role, content) {
  const chatContainer = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}-message`;
  
  // 根据角色设置不同样式和发送者名称
  let sender = role === 'user' ? '你' : role === 'assistant' ? currentAiProvider : '系统';
  
  // 格式化消息内容
  const formattedContent = formatMessageContent(content);
  
  // 添加复制按钮（仅对AI回复）
  let copyButtonHTML = '';
  if (role === 'assistant') {
    copyButtonHTML = '<div class="message-actions"><button class="copy-message-btn">复制</button></div>';
  }
  
  messageDiv.innerHTML = `
    <div class="message-sender">${sender}</div>
    <div class="message-content">${formattedContent}</div>
    ${copyButtonHTML}
  `;
  
  chatContainer.appendChild(messageDiv);
  
  // 添加复制功能
  if (role === 'assistant') {
    const copyButton = messageDiv.querySelector('.copy-message-btn');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        // 复制原始纯文本内容，而不是HTML格式
        navigator.clipboard.writeText(content)
          .then(() => {
            // 成功复制后改变按钮状态
            copyButton.textContent = '已复制!';
            copyButton.classList.add('copied');
            // 2秒后恢复
            setTimeout(() => {
              copyButton.textContent = '复制';
              copyButton.classList.remove('copied');
            }, 2000);
          })
          .catch(err => {
            console.error('复制失败:', err);
            copyButton.textContent = '复制失败';
            setTimeout(() => {
              copyButton.textContent = '复制';
            }, 2000);
          });
      });
    }
  }
  
  // 滚动到最新消息
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 格式化消息内容，改善文本显示
function formatMessageContent(content) {
  if (!content) return '';
  
  // 安全处理：转义HTML特殊字符防止XSS
  let safeContent = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // 处理换行，转换为<br>
  safeContent = safeContent.replace(/\n\n+/g, '</p><p>'); // 多行换行变成段落
  safeContent = safeContent.replace(/\n/g, '<br>'); // 单行换行
  
  // 识别并格式化列表项
  safeContent = safeContent
    .replace(/^(\d+\.|\*|\-)\s(.+)$/gm, '<li>$2</li>') // 识别列表项
    .replace(/<li>(.+)<\/li><br>/g, '<li>$1</li>'); // 修复列表项后的换行
  
  // 处理可能的标题（以#开头的行）
  safeContent = safeContent.replace(/^(#{1,6})\s+(.+?)$/gm, function(match, hashes, text) {
    const level = hashes.length;
    return `<h${level+2}>${text}</h${level+2}>`;
  });
  
  // 强调文本（*文本* 变为 <em>文本</em>）
  safeContent = safeContent.replace(/(\*|_)([^\*_]+)(\*|_)/g, '<em>$2</em>');
  
  // 加粗文本（**文本** 变为 <strong>文本</strong>）
  safeContent = safeContent.replace(/(\*\*|__)([^\*_]+)(\*\*|__)/g, '<strong>$2</strong>');
  
  // 代码格式（`代码` 变为 <code>代码</code>）
  safeContent = safeContent.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 包装段落
  if (!safeContent.startsWith('<h') && !safeContent.startsWith('<p>')) {
    safeContent = '<p>' + safeContent + '</p>';
  }
  
  return safeContent;
}

// 其他原有功能保持不变...