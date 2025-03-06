document.getElementById('save').addEventListener('click', () => {
  const aiProvider = document.getElementById('aiProvider').value;
  const apiKey = document.getElementById('apiKey').value.trim();
  if (apiKey) {
    chrome.storage.sync.set({ 
      [aiProvider + 'ApiKey']: apiKey,
      activeAiProvider: aiProvider 
    }, () => {
      const status = document.getElementById('status');
      status.textContent = 'API密钥已保存！';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
      loadCurrentApiKey(); // 保存后刷新显示
    });
  } else {
    alert('请输入有效的API密钥！');
  }
});

document.getElementById('toggleTranslation').addEventListener('click', () => {
  chrome.storage.sync.get(['translationEnabled'], (result) => {
    const isEnabled = result.translationEnabled !== false; // 默认启用
    const newEnabled = !isEnabled;
    chrome.storage.sync.set({ translationEnabled: newEnabled }, () => {
      const toggleButton = document.getElementById('toggleTranslation');
      toggleButton.textContent = newEnabled ? '暂停翻译' : '取消暂停翻译';
      toggleButton.classList.toggle('active', newEnabled);
      const status = document.getElementById('status');
      status.textContent = newEnabled ? '翻译已启用' : '翻译已暂停';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    });
  });
});

function loadCurrentApiKey() {
  const aiProvider = document.getElementById('aiProvider').value;
  chrome.storage.sync.get([aiProvider + 'ApiKey'], (result) => {
    const apiKeyInput = document.getElementById('apiKey');
    apiKeyInput.value = result[aiProvider + 'ApiKey'] || '';
  });
}

// 页面加载时初始化设置
chrome.storage.sync.get(['deepseekApiKey', 'kimiApiKey', 'activeAiProvider', 'translationEnabled'], (result) => {
  const aiProvider = document.getElementById('aiProvider');
  const apiKeyInput = document.getElementById('apiKey');
  const toggleButton = document.getElementById('toggleTranslation');

  // 设置当前选择的AI
  const activeAi = result.activeAiProvider || 'deepseek';
  aiProvider.value = activeAi;

  // 加载对应AI的API密钥
  const apiKey = result[activeAi + 'ApiKey'] || '';
  apiKeyInput.value = apiKey;

  // 初始化翻译状态
  const isEnabled = result.translationEnabled !== false; // 默认启用
  toggleButton.textContent = isEnabled ? '暂停翻译' : '取消暂停翻译';
  toggleButton.classList.toggle('active', isEnabled);

  // 监听AI选择变化，动态加载对应API密钥
  aiProvider.addEventListener('change', () => {
    loadCurrentApiKey();
  });
});