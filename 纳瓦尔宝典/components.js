// 定义页面组件
class PageComponents {
  // 页面容器结构
  static pageContainer() {
    return `
      <div class="article-container">
        <div class="content-wrapper" id="page-content">
          <!-- 页面内容将被插入到这里 -->
        </div>
        
        <!-- 页脚作者信息 -->
        <div class="creator-info">
          <div class="creator-logo">Y</div>
          <div class="creator-text">由 <span class="creator-name">Yaron</span> 制作 | 代码沉思录</div>
        </div>
      </div>
    `;
  }
}

// 调试函数
function debug(message) {
  console.log('[组件化] ' + message);
}

// 显示错误信息在页面上
function showError(error) {
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>页面加载错误</h2>
      <p>${error.message}</p>
      <div>
        <button onclick="window.location.reload()">重新加载</button>
      </div>
    </div>
  `;
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
  debug('页面加载完成');
  
  try {
    // 1. 添加加载提示
    const loadingEl = document.createElement('div');
    loadingEl.style.position = 'fixed';
    loadingEl.style.top = '0';
    loadingEl.style.left = '0';
    loadingEl.style.width = '100%';
    loadingEl.style.padding = '10px';
    loadingEl.style.background = 'rgba(255,255,255,0.8)';
    loadingEl.style.textAlign = 'center';
    loadingEl.innerHTML = '组件加载中...';
    document.body.appendChild(loadingEl);
    
    // 2. 获取页面内容
    const pageContent = document.getElementById('page-data');
    if (!pageContent) {
      throw new Error('未找到页面内容数据元素 (id="page-data")');
    }
    
    debug('找到页面内容数据');
    
    // 3. 获取内容HTML
    const contentHTML = pageContent.innerHTML;
    debug('内容长度: ' + contentHTML.length + '字符');
    
    // 4. 使用组件初始化页面结构
    const originalBody = document.body.innerHTML;
    document.body.innerHTML = PageComponents.pageContainer();
    debug('页面容器创建完成');
    
    // 5. 将页面内容插入到内容区域
    const contentContainer = document.getElementById('page-content');
    if (!contentContainer) {
      debug('未找到内容容器，恢复原始内容');
      document.body.innerHTML = originalBody;
      throw new Error('未找到内容容器元素 (id="page-content")');
    }
    
    contentContainer.innerHTML = contentHTML;
    debug('内容已插入到页面');
    
    // 移除加载提示
    loadingEl.remove();
    
  } catch (error) {
    console.error('组件初始化错误:', error);
    showError(error);
  }
}); 