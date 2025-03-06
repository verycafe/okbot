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
  loadWordList(); // 加载单词表
}

// 加载单词表
function loadWordList() {
  chrome.storage.sync.get(['highlightedWords', 'wordData'], (result) => {
    const wordList = document.getElementById('wordList');
    wordList.innerHTML = '';
    const words = result.highlightedWords || [];
    words.forEach(word => {
      const li = document.createElement('li');
      const wordData = result.wordData?.[word] || {};
      li.innerHTML = `
        ${word} 
        <button class="remove-word" data-word="${word}">取消划线</button>
      `;
      wordList.appendChild(li);

      // 取消划线
      li.querySelector('.remove-word').addEventListener('click', () => {
        highlightedWords.delete(word);
        delete result.wordData?.[word];
        chrome.storage.sync.set({ highlightedWords: Array.from(highlightedWords), wordData: result.wordData }, () => {
          alert(`${word} 已从单词表移除！`);
          loadWordList();
          updateHighlightedWords(); // 更新页面高亮
        });
      });
    });
  });
}

// 页面加载时初始化设置
chrome.storage.sync.get(['deepseekApiKey', 'kimiApiKey', 'activeAiProvider', 'translationEnabled', 'highlightedWords', 'wordData'], (result) => {
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

  // 初始化高亮单词
  if (result.highlightedWords) highlightedWords = new Set(result.highlightedWords);

  // 加载单词表
  loadWordList();

  // 监听AI选择变化，动态加载对应API密钥
  aiProvider.addEventListener('change', () => {
    loadCurrentApiKey();
  });
});