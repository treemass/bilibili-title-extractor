// ==UserScript==
// @name         B站标题链接Excel提取增强版
// @version      1.25
// @description  右上角面板 + 收藏夹每个视频左上角复制按钮（修复鼠标悬停按钮时自动隐藏的问题）
// @author       YourName
// @match        *://*.bilibili.com/*
// @grant        GM_setClipboard
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==
(function() {
    'use strict';
    
    const STORAGE_KEY = 'bili_stay_open_flag';
    
    let isStayOpen = false;
    try {
        const saved = GM_getValue(STORAGE_KEY, null);
        if (saved === true) {
            isStayOpen = true;
        }
    } catch (e) {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'true') {
                isStayOpen = true;
            }
        } catch (e2) {}
    }
    
    let isHide = !isStayOpen;
    let wrap, floatBall;
    let excelText = '';

    function cleanBilibiliTitle(title) {
        if (!title) return '';
        let cleaned = title.trim();
        
        if (cleaned.includes('-稍后再看-哔哩哔哩视频')) {
            const match = cleaned.match(/^(.+?)-[^-]+-稍后再看-哔哩哔哩视频$/);
            if (match) return match[1].trim();
            const firstDash = cleaned.indexOf('-');
            if (firstDash > 0) return cleaned.substring(0, firstDash).trim();
        }
        if (cleaned.includes('-稍后再看')) {
            const match = cleaned.match(/^(.+?)-[^-]+-稍后再看$/);
            if (match) return match[1].trim();
            const firstDash = cleaned.indexOf('-');
            if (firstDash > 0) return cleaned.substring(0, firstDash).trim();
        }
        
        const patterns = [
            { regex: /_(?:哔哩哔哩|bilibili)\s*[（(][^）)]*[）)][^_]*$/, replacement: '' },
            { regex: /_哔哩哔哩_bilibili$/, replacement: '' },
            { regex: /_哔哩哔哩$/, replacement: '' },
            { regex: /_bilibili$/i, replacement: '' },
            { regex: /\s*-\s*哔哩哔哩$/, replacement: '' },
            { regex: /\s*-\s*bilibili$/i, replacement: '' },
            { regex: /_(?:游戏热门视频|动画短片|音乐现场|影视剪辑|搞笑日常|生活记录|知识科普|科技数码|时尚美妆|运动健身|汽车测评|美食探店|旅游风光|纪录片|综艺娱乐|鬼畜调教|动漫|游戏|音乐|舞蹈|生活|知识|科技|资讯|影视|娱乐|鬼畜|时尚|运动|汽车|美食|纪录片|综艺|动画|番剧|国创)\s*$/, replacement: '' },
            { regex: /_[（(][^）)]*[）)]\s*$/, replacement: '' },
            { regex: /_[（(][^）)]*[）)][^_]*$/, replacement: '' },
            { regex: /_[^_\s]+$/, replacement: '' }
        ];
        
        cleaned = cleaned.replace(/\s*-\s*哔哩哔哩$/, '');
        cleaned = cleaned.replace(/\s*-\s*bilibili$/i, '');
        
        for (let pattern of patterns) {
            cleaned = cleaned.replace(pattern.regex, pattern.replacement);
        }
        
        if (!cleaned.trim()) return title.trim();
        cleaned = cleaned.replace(/[_\-\s]+$/, '');
        return cleaned.trim();
    }

    function cleanBilibiliUrl(url) {
        if (!url) return url;
        
        if (url.includes('/list/watchlater/') && url.includes('bvid=')) {
            const match = url.match(/bvid=([A-Za-z0-9]+)/);
            if (match && match[1]) return `https://www.bilibili.com/video/${match[1]}/`;
        }
        if (url.includes('bvid=')) {
            const match = url.match(/bvid=([A-Za-z0-9]+)/);
            if (match && match[1]) return `https://www.bilibili.com/video/${match[1]}/`;
        }
        if (url.includes('/video/')) {
            url = url.replace(/\?.*$/, '');
            url = url.replace(/\/+$/, '');
            if (!url.endsWith('/')) {
                url = url + '/';
            }
            return url;
        }
        url = url.replace(/\?.*$/, '');
        url = url.replace(/\/+$/, '');
        return url;
    }

    function addCopyButtonsToCards() {
        const cardSelectors = [
            '.fav-list-item',
            '.fav-card-item',
            '.fav-item',
            '.list-item',
            '.video-item',
            '.bili-video-card',
            '.grid-card-item',
            '[class*="fav-list"]',
            '[class*="fav-item"]',
            '.items .item'
        ];
        
        let cards = [];
        for (let sel of cardSelectors) {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                cards = Array.from(elements);
                break;
            }
        }
        
        if (cards.length === 0) {
            const links = document.querySelectorAll('a[href*="/video/"], a[href*="bvid="]');
            for (let link of links) {
                const card = link.closest('li, .item, .card, [class*="item"], [class*="card"], [class*="fav"]');
                if (card && !cards.includes(card)) {
                    cards.push(card);
                }
            }
        }
        
        if (cards.length === 0) {
            const titleEls = document.querySelectorAll('.title, .video-title, .bili-video-card__title, .list-item-title, [class*="title"]');
            for (let el of titleEls) {
                const card = el.closest('li, .item, .card, [class*="item"], [class*="card"], [class*="fav"]');
                if (card && !cards.includes(card)) {
                    const link = card.querySelector('a[href*="/video/"], a[href*="bvid="]');
                    if (link) {
                        cards.push(card);
                    }
                }
            }
        }
        
        cards.forEach((card) => {
            if (card.querySelector('.bili-copy-btn')) return;
            
            if (getComputedStyle(card).position === 'static') {
                card.style.position = 'relative';
            }
            
            let coverElement = card.querySelector('.bili-video-card__cover, .cover, .bili-cover-card, [class*="cover"]');
            if (!coverElement) {
                coverElement = card;
            }
            
            let title = '';
            const titleSelectors = [
                '.title',
                '.video-title',
                '.bili-video-card__title',
                '.list-item-title',
                'a[title]',
                'h3',
                '.name',
                '[class*="title"]'
            ];
            
            for (let sel of titleSelectors) {
                const el = card.querySelector(sel);
                if (el) {
                    title = el.getAttribute('title') || el.innerText || '';
                    if (title) break;
                }
            }
            
            if (!title) {
                const link = card.querySelector('a[href*="/video/"], a[href*="bvid="]');
                if (link) {
                    title = link.getAttribute('title') || link.innerText || '';
                }
            }
            
            let url = '';
            const linkEl = card.querySelector('a[href*="/video/"], a[href*="bvid="]');
            if (linkEl) {
                url = linkEl.href || '';
            }
            
            if (url && url.startsWith('//')) {
                url = 'https:' + url;
            }
            if (url && url.startsWith('/')) {
                url = 'https://www.bilibili.com' + url;
            }
            
            if (!title && !url) return;
            
            const cleanTitle = cleanBilibiliTitle(title || '未知标题');
            const cleanUrl = cleanBilibiliUrl(url || location.href);
            
            const btn = document.createElement('button');
            btn.className = 'bili-copy-btn';
            btn.title = '复制标题和链接';
            Object.assign(btn.style, {
                position: 'absolute',
                top: '8px',
                left: '8px',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: 'rgba(33, 33, 33, 0.8)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                zIndex: '999',
                opacity: '0',
                transition: 'width .3s, opacity 0.25s ease, background 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                pointerEvents: 'none',
                boxSizing: 'border-box',
                flexShrink: '0'
            });

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'white');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.style.display = 'block';
            svg.style.flexShrink = '0';
            svg.innerHTML = `
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            `;
            btn.appendChild(svg);
            
            coverElement.addEventListener('mouseenter', () => {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            });
            
            coverElement.addEventListener('mouseleave', (e) => {
                const relatedTarget = e.relatedTarget;
                if (relatedTarget && btn.contains(relatedTarget)) {
                    return;
                }
                btn.style.opacity = '0';
                btn.style.pointerEvents = 'none';
            });
            
            btn.addEventListener('mouseenter', () => {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            });
            
            btn.addEventListener('mouseleave', () => {
                btn.style.opacity = '0';
                btn.style.pointerEvents = 'none';
            });
            
            btn.addEventListener('mouseenter', () => {
                btn.style.backgroundColor = 'rgba(33, 33, 33, 0.95)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.backgroundColor = 'rgba(33, 33, 33, 0.8)';
            });
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const copyText = `${cleanTitle}\t${cleanUrl}\t`;
                try {
                    GM_setClipboard(copyText);
                    btn.style.backgroundColor = 'rgba(76, 175, 80, 0.85)';
                    svg.innerHTML = `
                        <polyline points="20 6 9 17 4 12"></polyline>
                    `;
                    svg.setAttribute('stroke', 'white');
                    setTimeout(() => {
                        btn.style.backgroundColor = 'rgba(33, 33, 33, 0.8)';
                        svg.innerHTML = `
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        `;
                        svg.setAttribute('stroke', 'white');
                    }, 1000);
                    console.log('[B站面板] 复制成功:', cleanTitle);
                } catch (err) {
                    console.error('[B站面板] 复制失败:', err);
                }
            });
            
            card.appendChild(btn);
        });
        
        if (cards.length > 0) {
            console.log(`[B站面板] 已为 ${cards.length} 个视频添加复制按钮`);
        }
    }

    wrap = document.createElement('div');
    Object.assign(wrap.style,{
        position:'fixed',
        top:'20px',
        right:'20px',
        background:'#ffffff',
        padding:'12px',
        border:'1px solid #fb7299',
        borderRadius:'8px',
        zIndex:'99999',
        boxShadow:'0 2px 12px #0002',
        minWidth:'240px',
        color:'#222222'
    });

    floatBall = document.createElement('div');
    Object.assign(floatBall.style,{
        position:'fixed',
        top:'20px',
        right:'20px',
        width:'36px',
        height:'36px',
        borderRadius:'50%',
        background:'#fb7299',
        color:'#fff',
        textAlign:'center',
        lineHeight:'36px',
        cursor:'pointer',
        zIndex:'99999',
        userSelect:'none'
    });
    floatBall.textContent = 'B';

    const stayWrap = document.createElement('div');
    stayWrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13px';
    const stayCheck = document.createElement('input');
    stayCheck.type = 'checkbox';
    stayCheck.style.width = '14px';
    stayCheck.style.height = '14px';
    stayCheck.checked = isStayOpen;
    const stayLabel = document.createElement('label');
    stayLabel.innerText = '切换页面保持面板打开';
    stayLabel.style.cursor = 'pointer';
    stayWrap.appendChild(stayCheck);
    stayWrap.appendChild(stayLabel);
    
    function saveStayOpenState(value) {
        try { GM_setValue(STORAGE_KEY, value); } catch (e) {}
        try { localStorage.setItem(STORAGE_KEY, String(value)); } catch (e) {}
    }
    
    stayCheck.onchange = function() {
        isStayOpen = this.checked;
        saveStayOpenState(isStayOpen);
        if (isStayOpen && isHide) {
            togglePanel();
        } else if (!isStayOpen && !isHide) {
            togglePanel();
        }
    };

    const titleDom = document.createElement('div');
    titleDom.style.cssText = 'margin:4px 0;word-break:break-all;max-height:80px;overflow:auto;font-size:13px;color:#111';
    const urlDom = document.createElement('div');
    urlDom.style.cssText = 'margin:4px 0;word-break:break-all;max-height:60px;overflow:auto;font-size:13px;color:#007aff';

    function tryUnfavorite() {
        setTimeout(() => {
            try {
                const toolbar = document.querySelector('.video-toolbar');
                if (toolbar) {
                    const allBtns = toolbar.querySelectorAll('button, .bili-button, [role="button"]');
                    for (let btn of allBtns) {
                        const combined = (btn.innerText || '') + (btn.getAttribute('aria-label') || '') + (btn.getAttribute('title') || '');
                        if (combined.includes('已收藏') || combined.includes('取消收藏')) {
                            if (btn.querySelector('svg') || btn.className.includes('fav') || btn.className.includes('like')) {
                                btn.click();
                                return;
                            }
                        }
                    }
                }
                const selectors = [
                    '.video-toolbar .bili-button--fav.on',
                    '.video-toolbar .bili-button--primary.on',
                    '.video-toolbar .bili-button[title="取消收藏"]',
                    '.video-fav.on',
                    '[data-action="fav"].on'
                ];
                for (let sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) { el.click(); return; }
                }
            } catch (e) {}
        }, 300);
    }

    const btnBox = document.createElement('div');
    btnBox.style.cssText = 'display:flex;gap:6px;margin-top:8px';
    const copyBtn = document.createElement('button');
    copyBtn.innerText = '复制Excel格式';
    copyBtn.style.cssText = 'flex:1;padding:5px 6px;background:#fb7299;color:#fff;border:none;border-radius:4px;cursor:pointer';
    copyBtn.onclick = ()=>{
        GM_setClipboard(excelText);
        tryUnfavorite();
    };
    const hideBtn = document.createElement('button');
    hideBtn.innerText = '隐藏';
    hideBtn.style.cssText = 'flex:0.7;padding:5px 6px;background:#ccc;border:none;border-radius:4px;cursor:pointer;color:#222';
    hideBtn.onclick = togglePanel;
    floatBall.onclick = togglePanel;
    btnBox.appendChild(copyBtn);
    btnBox.appendChild(hideBtn);

    wrap.append(stayWrap, titleDom, urlDom, btnBox);
    document.body.appendChild(wrap);
    document.body.appendChild(floatBall);

    if (isHide) {
        wrap.style.display = 'none';
        floatBall.style.display = 'block';
    } else {
        wrap.style.display = 'block';
        floatBall.style.display = 'none';
    }

    function togglePanel(){
        isHide = !isHide;
        if(isHide){
            wrap.style.display = 'none';
            floatBall.style.display = 'block';
        }else{
            wrap.style.display = 'block';
            floatBall.style.display = 'none';
        }
        saveStayOpenState(isStayOpen);
    }

    function isUpSpacePage(){
        return /^https?:\/\/space\.bilibili\.com\/\d+/.test(location.href);
    }

    function getUpSpaceHomeUrl(){
        const match = location.href.match(/^(https?:\/\/space\.bilibili\.com\/\d+)/);
        return match ? match[1] : location.href;
    }

    function getUpName(){
        let userName = '';
        const selectorList = ['.h-name__name','.h-name','.user-name'];
        for(let sel of selectorList){
            const dom = document.querySelector(sel);
            if(dom){
                const pureText = [...dom.childNodes]
                    .filter(node => node.nodeType === Node.TEXT_NODE)
                    .map(item=>item.textContent.trim())
                    .join('');
                if(pureText){
                    userName = pureText;
                    break;
                }
            }
        }
        if(!userName){
            let pageTitle = document.title;
            userName = pageTitle.split('-')[0]
                .replace(/(的个人空间|个人主页|哔哩哔哩)/g,'')
                .trim();
            if (!userName) {
                userName = pageTitle.split(' ')[0] || pageTitle;
            }
        }
        return userName;
    }

    function updateInfo(){
        let showTitle;
        let displayUrl;
        
        if (isUpSpacePage()) {
            showTitle = getUpName();
            displayUrl = getUpSpaceHomeUrl();
        } else {
            let rawTitle = document.title;
            showTitle = cleanBilibiliTitle(rawTitle);
            displayUrl = cleanBilibiliUrl(location.href);
            if (!showTitle) {
                showTitle = rawTitle.replace(' - 哔哩哔哩', '').replace('_哔哩哔哩_bilibili', '');
            }
        }
        
        excelText = `${showTitle}\t${displayUrl}\t`;
        titleDom.innerText = '标题：' + showTitle;
        urlDom.innerText = '链接：' + displayUrl;
    }

    updateInfo();

    let observerTimer = null;
    let copyBtnObserver = null;

    function initCopyButtons() {
        setTimeout(addCopyButtonsToCards, 800);
        setTimeout(addCopyButtonsToCards, 2000);
        setTimeout(addCopyButtonsToCards, 3500);
        
        if (copyBtnObserver) {
            copyBtnObserver.disconnect();
        }
        copyBtnObserver = new MutationObserver(() => {
            clearTimeout(observerTimer);
            observerTimer = setTimeout(() => {
                addCopyButtonsToCards();
            }, 600);
        });
        copyBtnObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'complete') {
        setTimeout(initCopyButtons, 500);
    } else {
        window.addEventListener('load', () => {
            setTimeout(initCopyButtons, 500);
        });
    }

    let lastUrl = location.href;
    setInterval(()=>{
        if(lastUrl !== location.href){
            lastUrl = location.href;
            setTimeout(updateInfo, 350);
            setTimeout(addCopyButtonsToCards, 600);
            if (copyBtnObserver) {
                copyBtnObserver.disconnect();
                copyBtnObserver = null;
            }
            setTimeout(initCopyButtons, 800);
            
            if (isStayOpen) {
                if (isHide) { togglePanel(); }
            } else {
                if (!isHide) { togglePanel(); }
            }
        }
    }, 800);

    console.log('[B站面板] 已加载，收藏夹视频复制按钮已启用');
})();
