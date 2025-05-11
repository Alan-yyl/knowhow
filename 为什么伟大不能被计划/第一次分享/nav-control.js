// nav-control.js - 控制导航显示的公共代码

// 从URL参数中获取指定名称的值
function getQueryParam(name) {
    const url = window.location.search;
    const params = new URLSearchParams(url);
    return params.get(name);
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 查找导航元素
    var nav = document.getElementById('page-nav');
    
    // 根据URL参数控制导航显示
    if(getQueryParam('showNav') === 'false') {
        if(nav) nav.style.display = 'none';
    }
});

// 向所有链接添加showNav参数
function updatePageLinks() {
    // 获取当前showNav参数值，默认为true
    const showNavValue = getQueryParam('showNav') === 'false' ? 'false' : 'true';
    
    // 获取所有分页链接
    const pageLinks = document.querySelectorAll('.pagination a');
    
    // 更新每个链接的URL
    pageLinks.forEach(link => {
        const href = link.getAttribute('href');
        // 检查URL是否已包含参数
        if (href.includes('?')) {
            // 已有参数，检查是否包含showNav
            if (href.includes('showNav=')) {
                // 已有showNav参数，不做修改
            } else {
                // 添加showNav参数
                link.setAttribute('href', href + '&showNav=' + showNavValue);
            }
        } else {
            // 没有参数，添加showNav参数
            link.setAttribute('href', href + '?showNav=' + showNavValue);
        }
    });
}

// 页面加载后更新链接
document.addEventListener('DOMContentLoaded', updatePageLinks); 