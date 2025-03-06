// kimi-api.js - 支持多API提供商的聊天助手模块

class AIChat {
    constructor() {
      this.messages = [];
      this.systemPrompt = "你是一个助手，负责基于网页内容回答问题。请提供简洁、准确的回答。";
      this.apiProvider = null;
      this.apiKey = null;
    }
  
    // 设置API提供商和密钥
    setApiConfig(provider, apiKey) {
      this.apiProvider = provider;
      this.apiKey = apiKey;
    }
  
    // 重置对话历史
    resetConversation() {
      this.messages = [];
    }
  
    // 设置系统提示
    setSystemPrompt(prompt) {
      this.systemPrompt = prompt;
    }
  
    // 添加消息到历史
    addMessage(role, content) {
      this.messages.push({ role, content });
      
      // 保持合理的历史长度，避免超过token限制
      if (this.messages.length > 10) {
        this.messages = this.messages.slice(-10);
      }
    }
  
    // 获取完整的消息历史（包含系统提示）
    getMessages(context = null) {
      let systemMessage = { 
        role: "system", 
        content: this.systemPrompt 
      };
      
      // 如果有上下文，把它加到系统提示中
      if (context) {
        systemMessage.content = `${this.systemPrompt}\n\n以下是网页内容，请基于这些内容回答问题：\n\n${context}`;
      }
      
      return [systemMessage, ...this.messages];
    }
  
    // 发送聊天消息
    async sendMessage(content, context = null) {
      if (!this.apiKey || !this.apiProvider) {
        throw new Error("API配置未设置，请先设置API提供商和密钥");
      }
  
      // 添加用户消息到历史
      this.addMessage("user", content);
  
      // 获取完整消息历史
      const messages = this.getMessages(context);
  
      try {
        let response;
        
        // 根据不同的API提供商调用不同的请求方法
        switch (this.apiProvider) {
          case 'kimi':
            response = await this.callKimiAPI(messages);
            break;
          case 'deepseek':
            response = await this.callDeepSeekAPI(messages);
            break;
          case 'openai':
            response = await this.callOpenAIAPI(messages);
            break;
          default:
            throw new Error(`不支持的API提供商: ${this.apiProvider}`);
        }
  
        // 添加助手回复到历史
        this.addMessage("assistant", response);
        
        return response;
      } catch (error) {
        console.error("API请求失败:", error);
        throw error;
      }
    }
  
    // 调用Kimi API
    async callKimiAPI(messages) {
      const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "moonshot-v1-8k",
          messages: messages,
          temperature: 0.3
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "API请求失败");
      }
  
      const data = await response.json();
      return data.choices[0].message.content;
    }
  
    // 调用DeepSeek API
    async callDeepSeekAPI(messages) {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: messages,
          temperature: 0.3
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "API请求失败");
      }
  
      const data = await response.json();
      return data.choices[0].message.content;
    }
  
    // 调用OpenAI API
    async callOpenAIAPI(messages) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: messages,
          temperature: 0.3
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "API请求失败");
      }
  
      const data = await response.json();
      return data.choices[0].message.content;
    }
  }
  
  // 导出供侧边栏使用
  window.AIChat = AIChat;