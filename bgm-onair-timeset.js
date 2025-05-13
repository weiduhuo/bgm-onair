// ==UserScript==
// @name         BGM Anime Time Set
// @namespace    http://tampermonkey.net/
// @version      0.0.5
// @description  在BGM.tv的点格子页面添加设置按钮，可以设置动画的播放时间并排序
// @author       age
// @match        https://bgm.tv/
// @match        https://bangumi.tv/
// @match        https://chii.in/
// @license      MIT
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // 0.0.5更新：主打一个兼容能力强，在此版本，你可以对显示位置进行调整，可以选择在平铺模式和列表模式都可以显示了！
    // 调整了添加设置按钮的方式，避免引起原界面的内容变化（比如switchTinyManager按钮莫名其妙的整体变色）；修改了图标，由emoji改成固定图片，保持显示样式的一致性和美观性。

    const STORAGE_KEY = 'BGM_HOME_ANIME_TIME_SET_AGE';
    const SETTINGS_KEY = 'BGM_HOME_ANIME_TIME_SETTINGS_AGE';
    const EXPIRATION_DAYS = 200;  // 自动过期，看完忘记删了也没事
    const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    let cachedContainer = null;
    let cachedAnimeTimeData = null;
    let cachedSettings = null;

    // 数据存储
    function getAnimeTimeData() {
        if (cachedAnimeTimeData) return cachedAnimeTimeData;
        
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return {};

        try {
            const parsed = JSON.parse(data);
            // 检查并清理过期
            const now = new Date();
            const cleanedData = {};
            
            for (const [id, entry] of Object.entries(parsed)) {
                if (entry.expiresAt && new Date(entry.expiresAt) > now) {
                    cleanedData[id] = {
                        weekDay: entry.weekDay,
                        time: entry.time
                    };
                }
            }
            
            cachedAnimeTimeData = cleanedData;
            return cachedAnimeTimeData;
        } catch (e) {
            console.error('Failed to parse anime time data:', e);
            return {};
        }
    }

    function setAnimeTimeData(data) {
        const now = new Date();
        const storageData = {};
        
        const existingData = getAnimeTimeData();
        
        for (const [id, entry] of Object.entries(data)) {
            storageData[id] = {
                ...entry,
                // 如果条目已存在且未被修改，保留原过期时间
                expiresAt: existingData[id] && existingData[id].weekDay === entry.weekDay && existingData[id].time === entry.time 
                    ? existingData[id].expiresAt 
                    : new Date(now.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
            };
        }
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
        cachedAnimeTimeData = data;
    }

    function getSettings() {
        if (cachedSettings) return cachedSettings;
        
        const settings = localStorage.getItem(SETTINGS_KEY);
        if (!settings) return getDefaultSettings();
        
        try {
            const parsed = JSON.parse(settings);
            cachedSettings = validateSettings(parsed);
            return cachedSettings;
        } catch (e) {
            console.error('Failed to parse settings:', e);
            return getDefaultSettings();
        }
    }

    function getDefaultSettings() {
        return { 
            setShow: true, 
            showStyleRed: 0,
            showStyleGreen: 0,
            showStyleBlue: 0,
            sortMethod: 0,
            showPlace: 0
        };
    }

    function validateSettings(settings) {
        // 确保设置存在，数字有效
        if (typeof settings.showStyleRed !== 'number' || settings.showStyleRed < 0 || settings.showStyleRed > 3) {
            settings.showStyleRed = 0;
        }
        if (typeof settings.showStyleGreen !== 'number' || settings.showStyleGreen < 0 || settings.showStyleGreen > 5) {
            settings.showStyleGreen = 0;
        }
        if (typeof settings.showStyleBlue !== 'number' || settings.showStyleBlue < 0 || settings.showStyleBlue > 3) {
            settings.showStyleBlue = 0;
        }
        if (typeof settings.sortMethod !== 'number' || settings.sortMethod < 0 || settings.sortMethod > 2) {
            settings.sortMethod = 0;
        }
        if (typeof settings.showPlace !== 'number' || settings.showPlace < 0 || settings.showPlace > 3) {
            settings.showPlace = 0;
        }
        return settings;
    }

    function setSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        cachedSettings = settings;
    }

    // 主初始化函数
    function init() {
        cachedContainer = document.getElementById('cloumnSubjectInfo');
        if (!cachedContainer) return;

        // 添加管理按钮
        addManagerButton();

        // 初始化数据
        cachedAnimeTimeData = getAnimeTimeData();
        cachedSettings = getSettings();

        // 为每个动画添加设置按钮
        addSetButtons();

        // 根据设置显示/隐藏SET按钮
        toggleSetButtons(cachedSettings.setShow);

        // 重新排序
        sortAnimeList();
    }

    // 添加管理按钮
    function addManagerButton() {
        const prgManagerHeader = document.getElementById('prgManagerHeader');
        if (!prgManagerHeader) return;

        if (document.getElementById('Age-js01-manager-button')) return;

        const newPrgManagerMode = document.createElement('ul');
        newPrgManagerMode.id = 'prgManagerMode';
        newPrgManagerMode.className = 'categoryTab clearit rr';

        const li = document.createElement('li');
        const managerButton = document.createElement('button');
        managerButton.id = 'Age-js01-manager-button';
        managerButton.innerHTML = '<div class="Age-js01-manager-iconclass"></div>';
        managerButton.addEventListener('click', showManagerModal);
        
        li.appendChild(managerButton);
        newPrgManagerMode.appendChild(li);

        prgManagerHeader.insertBefore(newPrgManagerMode, prgManagerHeader.firstChild);
    }

    // 显示管理框
    function showManagerModal() {
        const modal = document.createElement('div');
        modal.id = 'Age-js01-manager-modal';
        
        modal.innerHTML = `
            <h3>时间管理</h3>
            <div id="Age-js01-manager-modal-content">
                <div>
                    <button id="Age-js01-auto-fetch">自动获取时间</button>
                    <input type="checkbox" id="Age-js01-diff-update" checked>
                    <label for="Age-js01-diff-update">Diff更新</label>
                    <select id="Age-js01-timezone-select">
                        <option value="-12">UTC-12</option>
                        <option value="-11">UTC-11</option>
                        <option value="-10">UTC-10</option>
                        <option value="-9">UTC-9</option>
                        <option value="-8">UTC-8</option>
                        <option value="-7">UTC-7</option>
                        <option value="-6">UTC-6</option>
                        <option value="-5">UTC-5</option>
                        <option value="-4">UTC-4</option>
                        <option value="-3">UTC-3</option>
                        <option value="-2">UTC-2</option>
                        <option value="-1">UTC-1</option>
                        <option value="0">UTC±0</option>
                        <option value="1">UTC+1</option>
                        <option value="2">UTC+2</option>
                        <option value="3">UTC+3</option>
                        <option value="4">UTC+4</option>
                        <option value="5">UTC+5</option>
                        <option value="6">UTC+6</option>
                        <option value="7">UTC+7</option>
                        <option value="8" selected>UTC+8</option>
                        <option value="9">UTC+9</option>
                        <option value="10">UTC+10</option>
                        <option value="11">UTC+11</option>
                        <option value="12">UTC+12</option>
                    </select>
                </div>
                <div style="margin-top: 10px;">
                    <h4>显示样式设置</h4>
                    <div>
                        <label for="Age-js01-show-style-red">红：</label>
                        <select id="Age-js01-show-style-red">
                            <option value="0">1小时内即将放送</option>
                            <option value="1">2小时内即将放送</option>
                            <option value="2">4小时内即将放送</option>
                            <option value="3">禁用</option>
                        </select>
                    </div>
                    <div style="margin-top: 5px;">
                        <label for="Age-js01-show-style-green">绿：</label>
                        <select id="Age-js01-show-style-green">
                            <option value="0">18小时内即将放送</option>
                            <option value="1">24小时内即将放送</option>
                            <option value="2">今天内即将放送</option>
                            <option value="3">明天6点前即将放送</option>
                            <option value="4">明天8点前即将放送</option>
                            <option value="5">禁用</option>
                        </select>
                    </div>
                    <div style="margin-top: 5px;">
                        <label for="Age-js01-show-style-blue">蓝：</label>
                        <select id="Age-js01-show-style-blue">
                            <option value="0">18小时内已经放送</option>
                            <option value="1">24小时内已经放送</option>
                            <option value="2">今天内已经放送</option>
                            <option value="3">禁用</option>
                        </select>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <h4>排序逻辑和显示范围</h4>
                    <select id="Age-js01-sort-method">
                        <option value="0">按照周日到周六的时间顺序排序</option>
                        <option value="1">将蓝红绿色放在最前面按时间排序</option>
                        <option value="2">禁用重新排序，保存原顺序</option>
                    </select>
                </div>
                <div style="margin-top: 5px;">
                    <select id="Age-js01-show-place">
                        <option value="0">仅在平铺模式显示</option>
                        <option value="1">在平铺模式和列表项显示</option>
                        <option value="2">在平铺模式和列表模式显示</option>
                        <option value="3">全部显示</option>
                    </select>
                </div>
                <button id="Age-js01-toggle-set">${cachedSettings.setShow ? '隐藏所有SET按钮' : '显示所有SET按钮'}</button>
                <div style="margin-top: 15px;">
                    <h4>存储内容 (${STORAGE_KEY})</h4>
                    <div id="Age-js01-storage-content" contenteditable="true">${JSON.stringify(getFullStorageData(), null, 2)}</div>
                </div>
            </div>
            <div style="text-align: right;">
                <button id="Age-js01-save-storage">保存修改</button>
                <button id="Age-js01-close-manager">关闭</button>
            </div>
        `;

        modal.querySelector('#Age-js01-show-style-red').value = cachedSettings.showStyleRed;
        modal.querySelector('#Age-js01-show-style-green').value = cachedSettings.showStyleGreen;
        modal.querySelector('#Age-js01-show-style-blue').value = cachedSettings.showStyleBlue;
        modal.querySelector('#Age-js01-sort-method').value = cachedSettings.sortMethod;
        modal.querySelector('#Age-js01-show-place').value = cachedSettings.showPlace || 0;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            const target = e.target;
            
            if (target.id === 'Age-js01-auto-fetch') {
                autoFetchSchedule();
            } else if (target.id === 'Age-js01-toggle-set') {
                const newSettings = { ...cachedSettings, setShow: !cachedSettings.setShow };
                setSettings(newSettings);
                toggleSetButtons(newSettings.setShow);
                target.textContent = newSettings.setShow ? '隐藏所有SET按钮' : '显示所有SET按钮';
            } else if (target.id === 'Age-js01-save-storage') {
                try {
                    const newData = JSON.parse(document.getElementById('Age-js01-storage-content').textContent);
                    const existingData = getFullStorageData();
                    const now = new Date();
                    
                    const mergedData = {};
                    for (const [id, entry] of Object.entries(newData)) {
                        mergedData[id] = {
                            ...entry,
                            expiresAt: existingData[id] && existingData[id].weekDay === entry.weekDay && existingData[id].time === entry.time
                                ? existingData[id].expiresAt
                                : new Date(now.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
                        };
                    }
                    
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedData));
                    cachedAnimeTimeData = getAnimeTimeData();
                    addSetButtons();
                    sortAnimeList();
                    alert('保存成功');
                } catch (e) {
                    alert('保存失败: JSON格式错误');
                    console.error(e);
                }
            } else if (target.id === 'Age-js01-close-manager') {
                const newSettings = {
                    ...cachedSettings,
                    showStyleRed: parseInt(modal.querySelector('#Age-js01-show-style-red').value),
                    showStyleGreen: parseInt(modal.querySelector('#Age-js01-show-style-green').value),
                    showStyleBlue: parseInt(modal.querySelector('#Age-js01-show-style-blue').value),
                    sortMethod: parseInt(modal.querySelector('#Age-js01-sort-method').value),
                    showPlace: parseInt(modal.querySelector('#Age-js01-show-place').value)
                };
                setSettings(newSettings);
                addSetButtons();
                sortAnimeList();
                document.body.removeChild(modal);
            }
        });
    }

    // 获取数据
    function getFullStorageData() {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    }

    async function autoFetchSchedule() {
        const isDiffUpdate = document.getElementById('Age-js01-diff-update')?.checked || false;
        if (!isDiffUpdate && !confirm('此操作将清空目前的时间表，是否继续？')) return;

        try {
            const subjectLinks = document.querySelectorAll('#cloumnSubjectInfo .infoWrapper_tv.hidden.clearit a[href^="/subject/"]');
            const subjectIds = new Set();
            subjectLinks.forEach(link => {
                const href = link.getAttribute('href');
                const match = href.match(/^\/subject\/(\d+)/);
                if (match && match[1]) subjectIds.add(match[1]);
            });

            if (subjectIds.size === 0) {
                alert('未找到任何动画条目ID');
                return;
            }

            const response = await fetch('https://raw.githubusercontent.com/zhollgit/bgm-onair/main/onair.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const newAnimeTimeData = isDiffUpdate ? getFullStorageData() : {};
            const timezoneOffset = parseInt(document.getElementById('Age-js01-timezone-select')?.value || 8);
            const now = new Date();

            data.items.forEach(item => {
                const bangumiSite = item.sites.find(site => site.site === 'bangumi');
                if (bangumiSite?.id && subjectIds.has(bangumiSite.id) && item.begin) {
                    if (isDiffUpdate && newAnimeTimeData[bangumiSite.id]) return;

                    const beginDate = new Date(item.begin);
                    let adjustedHours = beginDate.getUTCHours() + timezoneOffset;
                    let adjustedDay = beginDate.getUTCDay();

                    // 处理跨天情况
                    if (adjustedHours >= 24) {
                        adjustedHours -= 24;
                        adjustedDay = (adjustedDay + 1) % 7;
                    } else if (adjustedHours < 0) {
                        adjustedHours += 24;
                        adjustedDay = (adjustedDay - 1 + 7) % 7;
                    }

                    const adjustedDate = new Date(beginDate);
                    adjustedDate.setUTCHours(adjustedHours, beginDate.getUTCMinutes(), 0, 0);

                    const time = `${adjustedHours.toString().padStart(2, '0')}:${beginDate.getUTCMinutes().toString().padStart(2, '0')}`;
                    newAnimeTimeData[bangumiSite.id] = { 
                        weekDay: adjustedDay, 
                        time,
                        expiresAt: new Date(now.getTime() + (EXPIRATION_DAYS || 7) * 24 * 60 * 60 * 1000).toISOString()
                    };
                }
            });

            localStorage.setItem(STORAGE_KEY, JSON.stringify(newAnimeTimeData));
            cachedAnimeTimeData = getAnimeTimeData();
            addSetButtons();
            sortAnimeList();

            const storageContent = document.getElementById('Age-js01-storage-content');
            if (storageContent) storageContent.textContent = JSON.stringify(newAnimeTimeData, null, 2);

            alert(`成功获取 ${Object.keys(newAnimeTimeData).length} 个动画的时间数据`);
        } catch (error) {
            if ((error instanceof TypeError) || (error.message.includes("Failed"))) {
                alert("返回内容失败，请检查能否连接Github："+ error.message);
            } 
            else if (error.message.includes("429")) {
                alert("API访问频繁，请稍后重试："+ error.message);
            }
            else {
                alert("请向组件作者反馈错误信息：" + error.message);
            }
            console.error(error);
        }
    }

    // 切换SET按钮的显示/隐藏
    function toggleSetButtons(show) {
        document.querySelectorAll('#Age-js01-button').forEach(button => {
            const subjectId = button.getAttribute('data-subject-id');
            if (!cachedAnimeTimeData[subjectId]) {
                button.style.display = show ? '' : 'none';
            }
        });
    }

    // 添加设置按钮
    function addSetButtons() {
        const showPlace = cachedSettings.showPlace || 0;
        
        const editLinks = cachedContainer.querySelectorAll('a.thickbox.l[id^="sbj_prg_"]:not([data-processed])');
        editLinks.forEach(editLink => {
            if (editLink.textContent.trim() === '[edit]') return;

            const subjectId = editLink.id.split('_')[2];
            editLink.setAttribute('data-processed', 'true');

            const setButton = document.createElement('button');
            setButton.id = 'Age-js01-button';
            setButton.setAttribute('data-subject-id', subjectId);
            
            if (cachedAnimeTimeData[subjectId]) {
                setButton.textContent = formatTimeData(cachedAnimeTimeData[subjectId]);
                const timeStatus = getTimeStatus(cachedAnimeTimeData[subjectId]);
                if (timeStatus) setButton.classList.add(timeStatus);
            } else {
                setButton.textContent = 'SET';
                if (!cachedSettings.setShow) setButton.style.display = 'none';
            }

            setButton.addEventListener('click', () => showTimeSettingDialog(subjectId, setButton));
            editLink.parentNode.insertBefore(setButton, editLink.nextSibling);
        });
        
        if (showPlace === 1 || showPlace === 3) {
            const editLinks = document.querySelectorAll('a.thickbox.l[id^="sbj_prg_"][title^="修改"]:not([data-processed-edit])');
            editLinks.forEach(editLink => {
                if (editLink.textContent.trim() !== '[edit]') return;
                
                const subjectId = editLink.id.split('_')[2];
                editLink.setAttribute('data-processed-edit', 'true');
                
                const setButton = document.createElement('button');
                setButton.id = 'Age-js01-button';
                setButton.setAttribute('data-subject-id', subjectId);
                
                if (cachedAnimeTimeData[subjectId]) {
                    setButton.textContent = formatTimeData(cachedAnimeTimeData[subjectId]);
                    const timeStatus = getTimeStatus(cachedAnimeTimeData[subjectId]);
                    if (timeStatus) setButton.classList.add(timeStatus);
                } else {
                    setButton.textContent = 'SET';
                    if (!cachedSettings.setShow) setButton.style.display = 'none';
                }
                
                setButton.addEventListener('click', () => showTimeSettingDialog(subjectId, setButton));
                editLink.parentNode.insertBefore(setButton, editLink.nextSibling);
            });
        }
        
        if (showPlace === 2 || showPlace === 3) {
            const titleLinks = document.querySelectorAll('a.subjectItem.title.textTip:not([data-processed-title])');
            titleLinks.forEach(titleLink => {
                const subjectId = titleLink.getAttribute('data-subject-id');
                if (!subjectId) return;
                
                titleLink.setAttribute('data-processed-title', 'true');
                
                const setButton = document.createElement('button');
                setButton.id = 'Age-js01-button';
                setButton.setAttribute('data-subject-id', subjectId);
                setButton.style.marginRight = '5px';
                
                if (cachedAnimeTimeData[subjectId]) {
                    setButton.textContent = formatTimeData(cachedAnimeTimeData[subjectId]);
                    const timeStatus = getTimeStatus(cachedAnimeTimeData[subjectId]);
                    if (timeStatus) setButton.classList.add(timeStatus);
                } else {
                    setButton.textContent = 'SET';
                    if (!cachedSettings.setShow) setButton.style.display = 'none';
                }
                
                setButton.addEventListener('click', () => showTimeSettingDialog(subjectId, setButton));
                titleLink.parentNode.insertBefore(setButton, titleLink);
            });
        }
    }

    // 获取时间状态
    function getTimeStatus(timeData) {
        const now = new Date();
        const today = now.getDay();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();

        const [hours, minutes] = timeData.time.split(':').map(Number);
        const targetDay = timeData.weekDay;

        let dayDiff = targetDay - today;
        if (dayDiff < -3) dayDiff += 7;
        else if (dayDiff > 3) dayDiff -= 7;

        const totalDiffHours = dayDiff * 24 + (hours - currentHours) + (minutes - currentMinutes) / 60;
        
        // 红色优先级最高
        if (cachedSettings.showStyleRed !== 3) {
            switch (cachedSettings.showStyleRed) {
                case 0: if (totalDiffHours >= 0 && totalDiffHours < 1) return 'soon'; break;
                case 1: if (totalDiffHours >= 0 && totalDiffHours < 2) return 'soon'; break;
                case 2: if (totalDiffHours >= 0 && totalDiffHours < 4) return 'soon'; break;
            }
        }
        
        // 绿色
        if (cachedSettings.showStyleGreen !== 5) {
            switch (cachedSettings.showStyleGreen) {
                case 0: if (totalDiffHours >= 0 && totalDiffHours < 18) return 'future'; break;
                case 1: if (totalDiffHours >= 0 && totalDiffHours < 24) return 'future'; break;
                case 2: if (dayDiff === 0 && totalDiffHours >= 0) return 'future'; break;
                case 3: if ((dayDiff === 0 && totalDiffHours >= 0) || (dayDiff === 1 && hours < 6)) return 'future'; break;
                case 4: if ((dayDiff === 0 && totalDiffHours >= 0) || (dayDiff === 1 && hours < 8)) return 'future'; break;
            }
        }
        
        // 蓝色
        if (cachedSettings.showStyleBlue !== 3) {
            switch (cachedSettings.showStyleBlue) {
                case 0: if (totalDiffHours >= -18 && totalDiffHours < 0) return 'past'; break;
                case 1: if (totalDiffHours >= -24 && totalDiffHours < 0) return 'past'; break;
                case 2: if (dayDiff === 0 && totalDiffHours < 0) return 'past'; break;
            }
        }
        
        return '';
    }

    // 显示时间设置对话框
    function showTimeSettingDialog(subjectId, button) {
        const dialog = document.createElement('div');
        dialog.id = 'Age-js01-dialog';

        const existingData = cachedAnimeTimeData[subjectId];
        
        const weekDayOptions = WEEK_DAYS.map((day, index) => {
            const selected = existingData && existingData.weekDay === index ? 'selected' : '';
            return `<option value="${index}" ${selected}>${day}</option>`;
        }).join('');

        dialog.innerHTML = `
            <label>星期: </label>
            <select id="Age-js01-select">${weekDayOptions}</select>
            <label style="margin-left:8px;">时间: </label>
            <input id="Age-js01-time" type="time" ${existingData ? `value="${existingData.time}"` : ''}>
            <div id="Age-js01-button-container">
                <button id="Age-js01-save">保存</button>
                <button id="Age-js01-clear">清除</button>
                <button id="Age-js01-cancel">取消</button>
            </div>
        `;

        document.body.appendChild(dialog);

        dialog.addEventListener('click', (e) => {
            if (e.target.id === 'Age-js01-save') {
                const weekDay = parseInt(dialog.querySelector('#Age-js01-select').value);
                const time = dialog.querySelector('#Age-js01-time').value;

                if (!time) {
                    alert('请选择时间');
                    return;
                }

                const fullData = getFullStorageData();
                const now = new Date();
                
                fullData[subjectId] = {
                    weekDay,
                    time,
                    expiresAt: new Date(now.getTime() + EXPIRATION_DAYS * 24 * 60 * 60 * 1000).toISOString()
                };
                
                localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
                cachedAnimeTimeData = getAnimeTimeData();

                // 先移除对话框
                document.body.removeChild(dialog);
                
                // 然后更新按钮内容
                button.textContent = formatTimeData(cachedAnimeTimeData[subjectId]);
                button.className = 'Age-js01-button';
                const timeStatus = getTimeStatus(cachedAnimeTimeData[subjectId]);
                if (timeStatus) button.classList.add(timeStatus);

                sortAnimeList();
            } else if (e.target.id === 'Age-js01-clear') {
                const fullData = getFullStorageData();
                
                if (fullData[subjectId]) {
                    delete fullData[subjectId];
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullData));
                    cachedAnimeTimeData = getAnimeTimeData();

                    // 先移除对话框
                    document.body.removeChild(dialog);
                    
                    // 更新按钮内容
                    button.textContent = 'SET';
                    button.className = 'Age-js01-button';
                    sortAnimeList();
                }
            } else if (e.target.id === 'Age-js01-cancel') {
                document.body.removeChild(dialog);
            }
        });
    }

    // 格式化显示
    function formatTimeData(timeData) {
        return `${WEEK_DAYS[timeData.weekDay]} ${timeData.time}`;
    }

    // 排序
    function sortAnimeList() {
        const wrapper = cachedContainer.querySelector('.infoWrapperContainer.infoWrapper_tv.hidden.clearit');
        if (!wrapper) return;

        // 如果排序方法为2（禁用排序），则直接返回
        if (cachedSettings.sortMethod === 2) return;

        const animeItems = Array.from(wrapper.querySelectorAll('.clearit.infoWrapper'));

        const originalOrderMap = new Map();
        animeItems.forEach((item, index) => {
            originalOrderMap.set(item.id, index);
        });

        if (cachedSettings.sortMethod === 1) {
            const coloredItems = [];
            const uncoloredItems = [];

            animeItems.forEach(item => {
                const itemId = item.id.split('_')[1];
                const itemData = cachedAnimeTimeData[itemId];
                const status = itemData ? getTimeStatus(itemData) : '';

                if (status) {
                    coloredItems.push(item);
                } else {
                    uncoloredItems.push(item);
                }
            });

            // 有颜色的条目按时间排序
            coloredItems.sort((a, b) => {
                const aId = a.id.split('_')[1];
                const bId = b.id.split('_')[1];
                const aData = cachedAnimeTimeData[aId];
                const bData = cachedAnimeTimeData[bId];

                if (!aData && !bData) return 0;
                if (!aData) return 1;
                if (!bData) return -1;

                // 获取当前日期
                const now = new Date();
                const today = now.getDay(); // 0是周日，6是周六

                // 调整周日和周六的顺序
                let aDay = aData.weekDay;
                let bDay = bData.weekDay;

                // 如果今天是周六，将周日视为7
                if (today === 6) {
                    if (aDay === 0) aDay = 7;
                    if (bDay === 0) bDay = 7;
                }
                // 如果今天是周日，将周六视为-1
                else if (today === 0) {
                    if (aDay === 6) aDay = -1;
                    if (bDay === 6) bDay = -1;
                }

                if (aDay !== bDay) return aDay - bDay;
                return aData.time.localeCompare(bData.time);
            });

            // 无颜色的条目保持原始顺序
            uncoloredItems.sort((a, b) => {
                return originalOrderMap.get(a.id) - originalOrderMap.get(b.id);
            });

            // 合并数组
            const sortedItems = [...coloredItems, ...uncoloredItems];
            const fragment = document.createDocumentFragment();
            sortedItems.forEach(item => fragment.appendChild(item));
            wrapper.appendChild(fragment);
            return;
        }

        // 默认排序
        animeItems.sort((a, b) => {
            const aId = a.id.split('_')[1];
            const bId = b.id.split('_')[1];
            const aData = cachedAnimeTimeData[aId];
            const bData = cachedAnimeTimeData[bId];

            if (!aData && !bData) return 0;
            if (!aData) return 1;
            if (!bData) return -1;
            if (aData.weekDay !== bData.weekDay) return aData.weekDay - bData.weekDay;
            return aData.time.localeCompare(bData.time);
        });

        const fragment = document.createDocumentFragment();
        animeItems.forEach(item => fragment.appendChild(item));
        wrapper.appendChild(fragment);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 0);
    }
})();
