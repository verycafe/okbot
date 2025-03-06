// slider.js - 侧边栏功能实现

// 确保脚本成功加载的初始日志
console.log("slider.js 开始加载...");

// 防止重复初始化的全局变量
if (window.sliderInitialized) {
  console.log("侧边栏已经初始化，跳过");
} else {
  window.sliderInitialized = true;
  console.log("开始初始化侧边栏...");
}

// 存储当前活动的AI提供商显示名称
let currentAiProvider = 'AI';

// AI提供商友好显示名称映射
const providerDisplayNames = {
  'deepseek': 'DeepSeek',
  'kimi': 'KIMI',
  'openai': 'OpenAI'
};

// AIChat类 - 处理与AI API的通信
// 如果类已从kimi-api.js加载，则使用该类；否则创建基本实现
if (typeof AIChat === 'undefined') {
  console.warn("AIChat类未找到，使用基本实现");
  class AIChat {
    constructor() {
      this.apiProvider = null;
      this.apiKey = null;
      this.systemPrompt = "你是一个助手，负责基于网页内容回答问题。请提供简洁、准确的回答。";
      this.conversationHistory = [];
    }
    
    setApiConfig(provider, apiKey) {
      this.apiProvider = provider;
      this.apiKey = apiKey;
      this.conversationHistory = []; // 重置对话历史
      console.log(`已设置API提供商: ${provider}`);
    }
    
    setSystemPrompt(prompt) {
      this.systemPrompt = prompt;
    }
    
    async sendMessage(userMessage, pageContext = null) {
      if (!this.apiKey) {
        throw new Error("API密钥未设置");
      }
      
      try {
        // 根据不同AI提供商构建消息
        const messages = this._buildMessages(userMessage, pageContext);
        
        // 根据不同AI提供商调用不同的API
        let response;
        
        switch (this.apiProvider) {
          case 'deepseek':
            response = await this._callDeepseekAPI(messages);
            break;
          case 'kimi':
            response = await this._callKimiAPI(messages);
            break;
          case 'openai':
            response = await this._callOpenAIAPI(messages);
            break;
          default:
            throw new Error(`不支持的API提供商: ${this.apiProvider}`);
        }
        
        // 添加到对话历史
        this.conversationHistory.push({ role: "user", content: userMessage });
        this.conversationHistory.push({ role: "assistant", content: response });
        
        // 如果对话历史太长，删除最旧的消息
        if (this.conversationHistory.length > 10) {
          this.conversationHistory = this.conversationHistory.slice(this.conversationHistory.length - 10);
        }
        
        return response;
      } catch (error) {
        console.error("API调用失败:", error);
        throw error;
      }
    }
    
    _buildMessages(userMessage, pageContext) {
      const messages = [];
      
      // 添加系统提示
      messages.push({ role: "system", content: this.systemPrompt });
      
      // 如果有页面上下文，添加到提示中
      if (pageContext) {
        messages.push({ 
          role: "system", 
          content: `以下是用户正在浏览的网页内容，请基于此回答问题:\n\n${pageContext}`
        });
      }
      
      // 添加历史对话记录
      for (let msg of this.conversationHistory) {
        messages.push(msg);
      }
      
      // 添加当前用户消息
      messages.push({ role: "user", content: userMessage });
      
      return messages;
    }
    
    async _callDeepseekAPI(messages) {
      const API_URL = "https://api.deepseek.com/v1/chat/completions";
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DeepSeek API错误: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    }
    
    async _callKimiAPI(messages) {
      const API_URL = "https://api.moonshot.cn/v1/chat/completions";
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "moonshot-v1-8k",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Kimi API错误: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    }
    
    async _callOpenAIAPI(messages) {
      const API_URL = "https://api.openai.com/v1/chat/completions";
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API错误: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    }
  }
  
  // 将AIChat类添加到全局作用域，以便其他部分可以访问
  window.AIChat = AIChat;
}

// 初始化AI聊天助手
let aiChat = null;

// 存储网页上下文
let pageContext = null;

// 确保样式表已加载
function ensureStylesLoaded() {
  return new Promise((resolve) => {
    // 检查样式表是否已加载
    const styleExists = Array.from(document.styleSheets).some(sheet => {
      try {
        // 尝试检查样式表规则中是否包含 .word-slider
        const rules = sheet.cssRules || sheet.rules;
        return Array.from(rules).some(rule => 
          rule.selectorText && rule.selectorText.includes('.word-slider')
        );
      } catch (e) {
        // 跨域样式表会抛出安全错误，忽略
        return false;
      }
    });

    if (styleExists) {
      console.log("slider.css 已加载");
      resolve();
    } else {
      console.warn("slider.css 可能未加载，尝试注入内联样式");
      
      // 临时注入基本样式，确保侧边栏可见
      const style = document.createElement('style');
      style.textContent = `
        .word-slider {
          position: fixed;
          top: 0;
          right: -350px;
          width: 350px;
          height: 100%;
          background: #1F1F1F;
          z-index: 10000;
          transition: right 0.3s ease;
          overflow-y: auto;
          font-family: sans-serif;
          color: #FFFFFF;
        }
        .word-slider.active {
          right: 0;
        }
      `;
      document.head.appendChild(style);
      
      // 给预加载一点时间
      setTimeout(resolve, 50);
    }
  });
}

// 创建侧边栏
function createSlider() {
  try {
    console.log("创建新的侧边栏...");
    
    // 检查body是否可用
    if (!document.body) {
      console.error("document.body 不可用，无法创建侧边栏");
      return null;
    }
    
    const slider = document.createElement('div');
    slider.className = 'word-slider';
    
    // 添加选项卡和内容 - 助手作为第一个选项卡且默认选中
    slider.innerHTML = `
      <div class="sidebar-header">
        <h2 class="sidebar-title">OKBot</h2>
        <button class="collapse-btn">×</button>
      </div>
      
      <!-- 选项卡导航 -->
      <div class="tab-navigation">
        <button class="tab-button active" data-tab="assistant">助手</button>
        <button class="tab-button" data-tab="settings">设置</button>
      </div>
      
      <!-- 选项卡内容 -->
      <div class="tab-content">
        <!-- 助手选项卡 -->
        <div class="tab-pane active" id="assistant-tab">
          <!-- 聊天问答部分 -->
          <div class="chat-section">
            <button id="summarizePageBtn" class="action-button">总结当前页面</button>
            <div id="chatMessages" class="chat-messages"></div>
            <div class="chat-input">
              <input type="text" id="chatInput" placeholder="输入问题...">
              <button id="sendMessageBtn">发送</button>
            </div>
          </div>
        </div>

        <!-- 设置选项卡 -->
        <div class="tab-pane" id="settings-tab">
          <div class="settings-section">
            <h3>翻译API设置</h3>
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
          </div>
          
          <!-- Flomo设置部分 - 现在在设置选项卡内 -->
          <div class="flomo-section">
            <h3>Flomo设置</h3>
            <label>
              Flomo API:
              <input type="text" id="flomoApiInSidebar" placeholder="输入Flomo API">
            </label>
            <button id="saveFlomoApiInSidebar">保存</button>
          </div>
          
          <div id="statusInSidebar"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(slider);
    
    // 初始化事件监听器
    initSidebar();
    
    return slider;
  } catch (error) {
    console.error("创建侧边栏失败:", error);
    return null;
  }
}

// 初始化侧边栏
function initSidebar() {
  try {
    console.log("初始化侧边栏组件和事件监听器...");
    
    // 初始化选项卡切换
    initTabNavigation();
    
    // 初始化关闭按钮
    const closeBtn = document.querySelector('.collapse-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log("关闭按钮被点击");
        const slider = document.querySelector('.word-slider');
        if (slider) slider.classList.remove('active');
      });
    } else {
      console.warn("关闭按钮未找到");
    }
    
    // 初始化设置
    initSettings();
    
    // 初始化Flomo相关功能
    initFlomoFeatures();
    
    // 初始化助手功能
    initAssistantFeatures();

    // 添加一条欢迎消息
    addMessageToChat('system', '欢迎使用AI助手。您可以直接提问或点击"总结当前页面"获取内容摘要。');
  } catch (error) {
    console.error("初始化侧边栏失败:", error);
  }
}

// 初始化选项卡切换
function initTabNavigation() {
  try {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    if (!tabButtons || tabButtons.length === 0) {
      console.warn("选项卡按钮未找到");
      return;
    }
    
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        const tabId = this.getAttribute('data-tab');
        console.log("切换到选项卡:", tabId);
        
        // 移除所有active类
        tabButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        // 添加active类到当前按钮
        this.classList.add('active');
        
        // 显示对应内容
        const tabPane = document.getElementById(`${tabId}-tab`);
        if (tabPane) {
          tabPane.classList.add('active');
        } else {
          console.warn(`找不到与选项卡对应的面板: ${tabId}-tab`);
        }
      });
    });
  } catch (error) {
    console.error("初始化选项卡导航失败:", error);
  }
}

// 初始化设置
function initSettings() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.error("chrome.storage.sync API不可用");
      // 添加错误提示到UI
      if (document.getElementById('statusInSidebar')) {
        document.getElementById('statusInSidebar').textContent = '错误: 无法访问扩展存储API';
      }
      return;
    }
    
    // 加载API设置
    chrome.storage.sync.get(['deepseekApiKey', 'kimiApiKey', 'openaiApiKey', 'activeAiProvider', 'translationEnabled'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("获取存储数据失败:", chrome.runtime.lastError);
        return;
      }
      
      const aiProvider = document.getElementById('aiProviderInSidebar');
      const apiKeyInput = document.getElementById('apiKeyInSidebar');
      const toggleButton = document.getElementById('toggleTranslationInSidebar');
      
      if (!aiProvider || !apiKeyInput || !toggleButton) {
        console.warn("设置元素未找到");
        return;
      }
      
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
          if (chrome.runtime.lastError) {
            console.error("获取API密钥失败:", chrome.runtime.lastError);
            return;
          }
          apiKeyInput.value = result[selectedProvider + 'ApiKey'] || '';
        });
      });
      
      // 保存API设置
      const saveBtn = document.getElementById('saveInSidebar');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          const selectedProvider = aiProvider.value;
          const apiKey = apiKeyInput.value.trim();
          
          if (apiKey) {
            chrome.storage.sync.set({ 
              [selectedProvider + 'ApiKey']: apiKey,
              activeAiProvider: selectedProvider 
            }, () => {
              if (chrome.runtime.lastError) {
                console.error("保存API密钥失败:", chrome.runtime.lastError);
                if (document.getElementById('statusInSidebar')) {
                  document.getElementById('statusInSidebar').textContent = '保存失败: ' + chrome.runtime.lastError.message;
                }
                return;
              }
              
              // 更新当前AI提供商显示名称
              currentAiProvider = providerDisplayNames[selectedProvider] || selectedProvider.toUpperCase();
              
              if (document.getElementById('statusInSidebar')) {
                document.getElementById('statusInSidebar').textContent = 'API密钥已保存！';
                setTimeout(() => {
                  if (document.getElementById('statusInSidebar')) {
                    document.getElementById('statusInSidebar').textContent = '';
                  }
                }, 2000);
              }
              
              // 初始化或更新AI聊天助手
              initAIChat();
            });
          } else {
            alert('请输入有效的API密钥！');
          }
        });
      }
      
      // 切换翻译状态
      toggleButton.addEventListener('click', () => {
        chrome.storage.sync.get(['translationEnabled'], (result) => {
          if (chrome.runtime.lastError) {
            console.error("获取翻译状态失败:", chrome.runtime.lastError);
            return;
          }
          
          const isEnabled = result.translationEnabled !== false; // 默认启用
          const newEnabled = !isEnabled;
          
          chrome.storage.sync.set({ translationEnabled: newEnabled }, () => {
            if (chrome.runtime.lastError) {
              console.error("保存翻译状态失败:", chrome.runtime.lastError);
              return;
            }
            
            toggleButton.textContent = newEnabled ? '暂停翻译' : '取消暂停翻译';
            toggleButton.classList.toggle('active', newEnabled);
            
            if (document.getElementById('statusInSidebar')) {
              document.getElementById('statusInSidebar').textContent = newEnabled ? '翻译已启用' : '翻译已暂停';
              setTimeout(() => {
                if (document.getElementById('statusInSidebar')) {
                  document.getElementById('statusInSidebar').textContent = '';
                }
              }, 2000);
            }
          });
        });
      });
      
      // 初始化AI聊天助手
      initAIChat();
    });
  } catch (error) {
    console.error("初始化设置失败:", error);
  }
}

// 初始化Flomo相关功能 - 修改后的代码
function initFlomoFeatures() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.error("chrome.storage.sync API不可用，无法初始化Flomo功能");
      return;
    }
    
    // 加载Flomo API
    chrome.storage.sync.get(['flomoApi'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("获取Flomo API失败:", chrome.runtime.lastError);
        return;
      }
      
      const flomoApiInput = document.getElementById('flomoApiInSidebar');
      if (!flomoApiInput) {
        console.warn("Flomo API输入框未找到");
        return;
      }
      
      flomoApiInput.value = result.flomoApi || '';
      
      // 保存Flomo API
      const saveFlomoBtn = document.getElementById('saveFlomoApiInSidebar');
      if (saveFlomoBtn) {
        saveFlomoBtn.addEventListener('click', () => {
          let flomoApi = flomoApiInput.value.trim();
          
          // 验证API格式
          if (!flomoApi) {
            alert('请输入有效的Flomo API地址');
            return;
          }
          
          // 确保URL格式正确
          if (!flomoApi.startsWith('http://') && !flomoApi.startsWith('https://')) {
            flomoApi = 'https://' + flomoApi;
          }
          
          console.log('保存Flomo API:', flomoApi);
          
          chrome.storage.sync.set({ flomoApi }, () => {
            if (chrome.runtime.lastError) {
              console.error("保存Flomo API失败:", chrome.runtime.lastError);
              alert('保存失败: ' + chrome.runtime.lastError.message);
              return;
            }
            
            if (document.getElementById('statusInSidebar')) {
              document.getElementById('statusInSidebar').textContent = 'Flomo API已保存！';
              setTimeout(() => {
                if (document.getElementById('statusInSidebar')) {
                  document.getElementById('statusInSidebar').textContent = '';
                }
              }, 2000);
            }
            
            // 显示额外的确认
            alert('Flomo API已成功保存!');
          });
        });
      } else {
        console.warn("保存Flomo API按钮未找到");
      }
    });
  } catch (error) {
    console.error("初始化Flomo功能失败:", error);
  }
}

// 初始化助手功能
function initAssistantFeatures() {
  try {
    // 总结页面按钮
    const summarizeBtn = document.getElementById('summarizePageBtn');
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', summarizePage);
    } else {
      console.warn("总结页面按钮未找到");
    }
    
    // 发送聊天消息按钮
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
      sendBtn.addEventListener('click', sendChatMessage);
    } else {
      console.warn("发送消息按钮未找到");
    }
    
    // 绑定回车键发送消息
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          sendChatMessage();
        }
      });
    } else {
      console.warn("聊天输入框未找到");
    }
  } catch (error) {
    console.error("初始化助手功能失败:", error);
  }
}

// 初始化AI聊天助手
function initAIChat() {
  try {
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      console.error("chrome.storage.sync API不可用，无法初始化AI聊天助手");
      return;
    }
    
    chrome.storage.sync.get(['activeAiProvider', 'deepseekApiKey', 'kimiApiKey', 'openaiApiKey'], (result) => {
      if (chrome.runtime.lastError) {
        console.error("获取AI设置失败:", chrome.runtime.lastError);
        return;
      }
      
      const provider = result.activeAiProvider || 'deepseek';
      const apiKey = result[provider + 'ApiKey'] || '';
      
      // 更新当前AI提供商显示名称
      currentAiProvider = providerDisplayNames[provider] || provider.toUpperCase();
      
      try {
        if (!aiChat) {
          aiChat = new AIChat();
        }
        
        if (apiKey) {
          aiChat.setApiConfig(provider, apiKey);
        } else {
          // 在聊天区域显示提示
          addMessageToChat('system', `请先在设置中配置${providerDisplayNames[provider] || provider.toUpperCase()} API密钥`);
        }
      } catch (error) {
        console.error("创建AIChat实例失败:", error);
        addMessageToChat('system', '初始化AI聊天助手失败，请刷新页面重试');
      }
    });
  } catch (error) {
    console.error("初始化AI聊天助手失败:", error);
  }
}

// 总结网页内容
async function summarizePage() {
  try {
    // 确保AI聊天助手已初始化
    if (!aiChat || !aiChat.apiKey) {
      addMessageToChat('system', '请先在设置中配置API密钥');
      return;
    }
    
    // 添加用户"请求总结"消息
    addMessageToChat('user', '请总结当前网页内容');
    
    // 显示AI正在思考的消息
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) {
      console.error("找不到聊天消息容器");
      return;
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message system-message';
    loadingDiv.innerHTML = '<div class="loading-indicator">AI正在总结网页内容...</div>';
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
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
      
      // 移除加载指示器
      if (chatContainer.contains(loadingDiv)) {
        chatContainer.removeChild(loadingDiv);
      }
      
      // 添加AI回复到聊天记录
      addMessageToChat('assistant', summary);
      
      // 重置系统提示为基于网页内容的问答
      aiChat.setSystemPrompt("你是一个助手，负责基于网页内容回答问题。请提供简洁、准确的回答。");
      
    } catch (error) {
      // 移除加载指示器
      if (chatContainer.contains(loadingDiv)) {
        chatContainer.removeChild(loadingDiv);
      }
      
      // 显示错误消息
      addMessageToChat('system', "获取总结失败: " + error.message);
      console.error("总结页面失败:", error);
    }
  } catch (error) {
    console.error("执行页面总结失败:", error);
    addMessageToChat('system', "总结功能错误: " + error.message);
  }
}

// 发送聊天消息
async function sendChatMessage() {
  try {
    // 确保AI聊天助手已初始化
    if (!aiChat || !aiChat.apiKey) {
      addMessageToChat('system', '请先在设置中配置API密钥');
      return;
    }
    
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) {
      console.error("找不到聊天输入框");
      return;
    }
    
    const input = chatInput.value.trim();
    if (!input) return;
    
    // 清空输入框
    chatInput.value = '';
    
    // 添加用户消息到UI
    addMessageToChat('user', input);
    
    // 如果还没有页面上下文，获取一部分
    if (!pageContext) {
      const pageContent = document.body.innerText;
      pageContext = pageContent.slice(0, 3000);
    }
    
    // 显示正在输入指示器
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) {
      console.error("找不到聊天消息容器");
      return;
    }
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message system-message';
    loadingDiv.innerHTML = '<div class="loading-indicator">AI正在思考...</div>';
    chatContainer.appendChild(loadingDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    try {
      // 发送消息到API
      const response = await aiChat.sendMessage(input, pageContext);
      
      // 移除加载指示器
      if (chatContainer.contains(loadingDiv)) {
        chatContainer.removeChild(loadingDiv);
      }
      
      // 添加助手回复到UI
      addMessageToChat('assistant', response);
    } catch (error) {
      // 移除加载指示器
      if (chatContainer.contains(loadingDiv)) {
        chatContainer.removeChild(loadingDiv);
      }
      
      // 显示错误消息
      addMessageToChat('system', "发送失败: " + error.message);
      console.error("发送消息失败:", error);
    }
  } catch (error) {
    console.error("发送聊天消息失败:", error);
    addMessageToChat('system', "聊天功能错误: " + error.message);
  }
}

// 添加消息到聊天UI
function addMessageToChat(role, content) {
  try {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) {
      console.error("找不到聊天消息容器");
      return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}-message`;
    
    // 根据角色设置不同样式和发送者名称
    let sender = role === 'user' ? '你' : role === 'assistant' ? currentAiProvider : '系统';
    
    // 格式化内容 - 处理换行和格式
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
  } catch (error) {
    console.error("添加消息到聊天UI失败:", error);
  }
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

// 检查是否已存在侧边栏，如不存在则创建
function setupSidebar() {
  try {
    console.log("检查侧边栏是否存在...");
    if (!document.querySelector('.word-slider')) {
      console.log("创建新的侧边栏...");
      createSlider();
    } else {
      console.log("侧边栏已存在");
    }
  } catch (error) {
    console.error("设置侧边栏失败:", error);
  }
}

// 监听扩展图标点击事件和其他消息
function setupMessageListener() {
  try {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) {
      console.error("chrome.runtime.onMessage API不可用，无法设置消息监听器");
      return;
    }
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        console.log("收到消息:", message.action || "未知消息", message);
        
        // 处理多种打开侧边栏的消息
        if (message.action === 'toggleSidebar' || message.action === 'showSlider') {
          console.log("收到打开侧边栏请求");
          
          ensureStylesLoaded().then(() => {
            const slider = document.querySelector('.word-slider') || createSlider();
            if (slider) {
              slider.classList.toggle('active');
              console.log("侧边栏状态已切换");
              
              // 返回成功状态
              if (sendResponse) {
                try {
                  sendResponse({ success: true });
                } catch (e) {
                  console.warn("发送响应失败:", e);
                }
              }
            } else {
              console.error("无法找到或创建侧边栏");
              if (sendResponse) {
                try {
                  sendResponse({ success: false, error: "无法找到或创建侧边栏" });
                } catch (e) {
                  console.warn("发送响应失败:", e);
                }
              }
            }
          });
          
          // 返回true以保持消息端口开放，等待异步响应
          return true;
        }
        
        // 处理侧栏检查请求
        if (message.action === 'checkSidebar') {
          console.log("收到侧栏检查请求");
          const exists = !!document.querySelector('.word-slider');
          
          if (!exists) {
            console.log("侧边栏不存在，现在创建");
            ensureStylesLoaded().then(() => {
              createSlider();
              if (sendResponse) {
                try {
                  sendResponse({ success: true, exists: false, created: true });
                } catch (e) {
                  console.warn("发送响应失败:", e);
                }
              }
            });
          } else {
            console.log("侧边栏已存在");
            if (sendResponse) {
              try {
                sendResponse({ success: true, exists: true });
              } catch (e) {
                console.warn("发送响应失败:", e);
              }
            }
          }
          
          // 返回true以保持消息端口开放
          return true;
        }
      } catch (error) {
        console.error("处理扩展消息失败:", error);
        if (sendResponse) {
          try {
            sendResponse({ success: false, error: error.message });
          } catch (e) {
            console.warn("发送错误响应失败:", e);
          }
        }
        return true;
      }
    });
    
    console.log("消息监听器已设置");
  } catch (error) {
    console.error("设置消息监听器失败:", error);
  }
}

// 在DOM加载完成后初始化侧边栏
function initializeWhenReady() {
  if (document.readyState === "loading") {
    // 在DOM完全加载后执行
    document.addEventListener("DOMContentLoaded", () => {
      console.log("DOM加载完成，开始初始化...");
      ensureStylesLoaded()
        .then(() => {
          setupMessageListener();
          setupSidebar();
        })
        .catch(error => {
          console.error("初始化失败:", error);
        });
    });
  } else {
    // 如果DOM已加载完成，立即执行
    console.log("DOM已加载，立即初始化...");
    ensureStylesLoaded()
      .then(() => {
        setupMessageListener();
        setupSidebar();
      })
      .catch(error => {
        console.error("初始化失败:", error);
      });
  }
}

// 启动初始化
initializeWhenReady();

// 最后一条日志确认脚本已完全加载
console.log("slider.js 完全加载完毕");