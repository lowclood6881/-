import * as pdfjsLib from './pdf.js';

// 設定 worker 路徑
pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.js';

// PDF 解析與檔案匯入
const fileInput = document.getElementById('fileInput');
const templateArea = document.getElementById('templateArea');
const markList = document.getElementById('markList');

fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const typedarray = new Uint8Array(evt.target.result);
            pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
                let textContent = '';
                let pagePromises = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    pagePromises.push(
                        pdf.getPage(i).then(function(page) {
                            return page.getTextContent().then(function(content) {
                                return content.items.map(item => item.str).join('');
                            });
                        })
                    );
                }
                Promise.all(pagePromises).then(function(pagesText) {
                    textContent = pagesText.join('\n');
                    templateArea.innerHTML = textContent.replace(/\n/g, '<br>');
                    renderMarkList();
                });
            });
        };
        reader.readAsArrayBuffer(file);
        fileInput.value = '';
        return;
    }
    // txt 檔案處理
    const reader = new FileReader();
    reader.onload = function(evt) {
        templateArea.innerHTML = evt.target.result.replace(/\n/g, '<br>');
        renderMarkList();
    };
    reader.readAsText(file, 'utf-8');
    fileInput.value = '';
});

// 以下為原本 HTML 內部的 JS 功能（標記、拖曳、同步、右鍵選單、UI 互動等）

const defaultOptions = {
    red: [],
    yellow: [],
    blue: [],
    green: {} // 依名稱分組
};

function getNextMarkNumber() {
    const spans = templateArea.querySelectorAll('span[data-mark]');
    let max = 0;
    spans.forEach(s => {
        const n = parseInt(s.getAttribute('data-mark'));
        if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
}

const customMenu = document.getElementById('customMenu');
let menuTarget = null;
let selectionInfo = null;

templateArea.addEventListener('contextmenu', function(e) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed && templateArea.contains(selection.anchorNode)) {
        e.preventDefault();
        menuTarget = selection.getRangeAt(0);
        selectionInfo = analyzeSelection(menuTarget);
        updateMenuButtons(selectionInfo);
        customMenu.style.display = 'block';
        customMenu.style.left = e.pageX + 'px';
        customMenu.style.top = e.pageY + 'px';
    } else {
        customMenu.style.display = 'none';
    }
});

document.addEventListener('click', function(e) {
    if (!customMenu.contains(e.target)) {
        customMenu.style.display = 'none';
    }
});

function analyzeSelection(range) {
    const intersectedSpans = [];
    const spans = templateArea.querySelectorAll('span[data-mark]');
    spans.forEach(span => {
        const spanRange = document.createRange();
        spanRange.selectNodeContents(span);
        try {
            if (range.compareBoundaryPoints(Range.END_TO_START, spanRange) < 0 &&
                range.compareBoundaryPoints(Range.START_TO_END, spanRange) > 0) {
                intersectedSpans.push(span);
            }
        } catch (e) {}
    });
    let isExactMatch = false;
    let exactMatchSpan = null;
    if (intersectedSpans.length === 1) {
        const span = intersectedSpans[0];
        const spanRange = document.createRange();
        spanRange.selectNodeContents(span);
        try {
            if (range.compareBoundaryPoints(Range.START_TO_START, spanRange) === 0 &&
                range.compareBoundaryPoints(Range.END_TO_END, spanRange) === 0) {
                isExactMatch = true;
                exactMatchSpan = span;
            }
        } catch (e) {}
    }
    return {
        hasIntersection: intersectedSpans.length > 0,
        intersectedSpans: intersectedSpans,
        isExactMatch: isExactMatch,
        exactMatchSpan: exactMatchSpan,
        canMark: intersectedSpans.length === 0,
        canChangeColor: isExactMatch,
        canRemove: intersectedSpans.length > 0
    };
}

function updateMenuButtons(info) {
    const buttons = customMenu.querySelectorAll('button');
    buttons.forEach(btn => {
        const action = btn.getAttribute('data-color');
        if (action === 'remove') {
            btn.disabled = !info.canRemove;
        } else {
            btn.disabled = !(info.canMark || info.canChangeColor);
        }
    });
}

const colorMap = {
    red:   { color: '#e74c3c', data: 'red' },
    yellow:{ color: '#f7c948', data: 'yellow' },
    blue:  { color: '#3498db', data: 'blue' },
    green: { color: '#28a745', data: 'green' }
};

function removeMarkSpans(spans) {
    spans.forEach(span => {
        while (span.firstChild) {
            span.parentNode.insertBefore(span.firstChild, span);
        }
        span.parentNode.removeChild(span);
    });
}

function removeMarkByNumber(markNumber) {
    const span = templateArea.querySelector(`span[data-mark="${markNumber}"]`);
    if (span) {
        removeMarkSpans([span]);
        renderMarkList();
    }
}

customMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        const colorKey = btn.getAttribute('data-color');
        if (!menuTarget || !selectionInfo) return;
        if (colorKey === 'remove') {
            removeMarkSpans(selectionInfo.intersectedSpans);
        } else {
            const colorInfo = colorMap[colorKey];
            if (!colorInfo) return;
            if (selectionInfo.canChangeColor) {
                const originalText = selectionInfo.exactMatchSpan.textContent;
                removeMarkSpans(selectionInfo.intersectedSpans);
                const range = menuTarget.cloneRange();
                range.deleteContents();
                const markNum = getNextMarkNumber();
                const span = document.createElement('span');
                span.style.color = "#222";
                span.style.borderBottom = "3px solid " + colorInfo.color;
                span.style.background = "none";
                span.className = 'mark-span';
                span.setAttribute('data-mark', markNum);
                span.setAttribute('data-color', colorInfo.data);
                span.setAttribute('data-name', '');
                span.setAttribute('data-original-text', originalText);
                span.setAttribute('contenteditable', 'false');
                span.textContent = originalText;
                range.insertNode(span);
            } else if (selectionInfo.canMark) {
                const range = menuTarget.cloneRange();
                const originalText = range.toString();
                range.deleteContents();
                const markNum = getNextMarkNumber();
                const span = document.createElement('span');
                span.style.color = "#222";
                span.style.borderBottom = "3px solid " + colorInfo.color;
                span.style.background = "none";
                span.className = 'mark-span';
                span.setAttribute('data-mark', markNum);
                span.setAttribute('data-color', colorInfo.data);
                span.setAttribute('data-name', '');
                span.setAttribute('data-original-text', originalText);
                span.setAttribute('contenteditable', 'false');
                span.textContent = originalText;
                range.insertNode(span);
            }
        }
        window.getSelection().removeAllRanges();
        customMenu.style.display = 'none';
        renderMarkList();
    });
});

window.addEventListener('resize', function() { customMenu.style.display = 'none'; });
window.addEventListener('scroll', function() { customMenu.style.display = 'none'; });

templateArea.addEventListener('input', function(e) {
    if (e.target.closest('span[data-mark]')) {
        e.preventDefault();
        return false;
    }
    setTimeout(renderMarkList, 100);
});

templateArea.addEventListener('keydown', function(e) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const markSpan = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
            ? range.commonAncestorContainer.parentNode 
            : range.commonAncestorContainer;
        if (markSpan.hasAttribute && markSpan.hasAttribute('data-mark')) {
            e.preventDefault();
            return false;
        }
    }
});

templateArea.addEventListener('keyup', function(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        renderMarkList();
    }
});

let dragSrcIdx = null;

function renderMarkList() {
    const spans = Array.from(templateArea.querySelectorAll('span[data-mark]')).filter(span => {
        return span.parentNode && templateArea.contains(span);
    });
    spans.sort((a, b) => parseInt(a.getAttribute('data-mark')) - parseInt(b.getAttribute('data-mark')));
    markList.innerHTML = '';
    spans.forEach((span, idx) => {
        const color = span.getAttribute('data-color') || 'red';
        const name = span.getAttribute('data-name') || '';
        const content = span.textContent || span.getAttribute('data-original-text') || '';
        const markNumber = span.getAttribute('data-mark');
        const li = document.createElement('li');
        li.className = 'mark-item';
        li.setAttribute('draggable', 'true');
        li.setAttribute('data-idx', idx);
        const markColorSpan = document.createElement('span');
        markColorSpan.className = `mark-color ${color}`;
        const markNameInput = document.createElement('input');
        markNameInput.className = 'mark-name';
        markNameInput.value = name;
        markNameInput.setAttribute('data-idx', idx);
        markNameInput.setAttribute('maxlength', '2');
        markNameInput.setAttribute('title', '標記名稱（可自訂）');
        const markContentDiv = document.createElement('div');
        markContentDiv.className = 'mark-content';
        const markContentWrapper = document.createElement('div');
        markContentWrapper.className = 'mark-content-wrapper';
        if (color === 'green') {
            const markContentSelect = document.createElement('select');
            markContentSelect.className = 'mark-content-select';
            markContentSelect.setAttribute('data-mark', markNumber);
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '-- 請選擇 --';
            markContentSelect.appendChild(emptyOption);
            const markName = name || '';
            const options = defaultOptions.green[markName] || [];
            options.forEach(optionText => {
                const option = document.createElement('option');
                option.value = optionText;
                option.textContent = optionText;
                markContentSelect.appendChild(option);
            });
            const currentOptions = Array.from(markContentSelect.options);
            const matchingOption = currentOptions.find(option => option.value === content);
            if (matchingOption) {
                markContentSelect.value = content;
            } else if (content) {
                const customOption = document.createElement('option');
                customOption.value = content;
                customOption.textContent = content + ' (自訂)';
                markContentSelect.appendChild(customOption);
                markContentSelect.value = content;
            }
            markContentWrapper.appendChild(markContentSelect);
            const addOptionBtn = document.createElement('button');
            addOptionBtn.className = 'add-option-btn';
            addOptionBtn.textContent = '新增';
            addOptionBtn.setAttribute('type', 'button');
            addOptionBtn.setAttribute('title', '新增選項');
            addOptionBtn.style.marginLeft = '4px';
            markContentWrapper.appendChild(addOptionBtn);
        } else if (color === 'blue') {
            const markContentInput = document.createElement('input');
            markContentInput.type = 'text';
            markContentInput.className = 'mark-content-input time-input';
            markContentInput.value = content;
            markContentInput.setAttribute('data-mark', markNumber);
            markContentInput.setAttribute('placeholder', '請輸入時間數字...');
            markContentInput.setAttribute('title', '輸入純數字，如：112、11203、1120315');
            markContentWrapper.appendChild(markContentInput);
            const formatBtn = document.createElement('button');
            formatBtn.className = 'format-btn';
            formatBtn.textContent = '轉換';
            formatBtn.setAttribute('type', 'button');
            formatBtn.setAttribute('title', '將數字轉換為完整時間格式');
            markContentWrapper.appendChild(formatBtn);
        } else {
            const markContentInput = document.createElement('input');
            markContentInput.type = 'text';
            markContentInput.className = 'mark-content-input';
            markContentInput.value = content;
            markContentInput.setAttribute('data-mark', markNumber);
            markContentInput.setAttribute('placeholder', '請輸入內容...');
            markContentWrapper.appendChild(markContentInput);
        }
        markContentDiv.appendChild(markContentWrapper);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.setAttribute('data-mark', markNumber);
        removeBtn.setAttribute('title', '取消此標記');
        removeBtn.textContent = '×';
        li.appendChild(markColorSpan);
        li.appendChild(markNameInput);
        li.appendChild(markContentDiv);
        li.appendChild(removeBtn);
        li.addEventListener('dragstart', function(e) {
            dragSrcIdx = idx;
            li.classList.add('dragging');
        });
        li.addEventListener('dragend', function(e) {
            dragSrcIdx = null;
            li.classList.remove('dragging');
            markList.querySelectorAll('.mark-item').forEach(item => item.classList.remove('drag-over'));
        });
        li.addEventListener('dragover', function(e) {
            e.preventDefault();
            if (parseInt(li.dataset.idx) !== dragSrcIdx) {
                li.classList.add('drag-over');
            }
        });
        li.addEventListener('dragleave', function(e) {
            li.classList.remove('drag-over');
        });
        li.addEventListener('drop', function(e) {
            e.preventDefault();
            const targetIdx = parseInt(li.dataset.idx);
            if (dragSrcIdx !== null && dragSrcIdx !== targetIdx) {
                reorderMarks(dragSrcIdx, targetIdx);
            }
        });
        markList.appendChild(li);
    });
    bindMarkListEvents(spans);
}

function syncContentByColorAndName(changedSpan) {
    const changedColor = changedSpan.getAttribute('data-color');
    const changedName = changedSpan.getAttribute('data-name');
    const changedContent = changedSpan.textContent;
    if (!changedName || changedName.trim() === '') {
        return;
    }
    const allSpans = Array.from(templateArea.querySelectorAll('span[data-mark]')).filter(span => {
        return span.parentNode && templateArea.contains(span);
    });
    allSpans.sort((a, b) => parseInt(a.getAttribute('data-mark')) - parseInt(b.getAttribute('data-mark')));
    const sameGroup = allSpans.filter(span => 
        span.getAttribute('data-color') === changedColor && 
        span.getAttribute('data-name') === changedName
    );
    if (sameGroup.length > 1) {
        const topSpan = sameGroup[0];
        const contentToSync = topSpan.textContent;
        sameGroup.forEach(span => {
            if (span !== topSpan) {
                span.textContent = contentToSync;
            }
        });
        setTimeout(() => {
            sameGroup.forEach(span => {
                const markNumber = span.getAttribute('data-mark');
                const input = document.querySelector(`input[data-mark="${markNumber}"]`);
                const select = document.querySelector(`select[data-mark="${markNumber}"]`);
                if (input && input.value !== contentToSync) {
                    input.value = contentToSync;
                }
                if (select && select.value !== contentToSync) {
                    select.value = contentToSync;
                }
            });
        }, 10);
    }
}

function bindMarkListEvents(spans) {
    markList.querySelectorAll('.mark-name').forEach(input => {
        input.addEventListener('input', function(e) {
            const idx = +input.dataset.idx;
            if (spans[idx]) {
                spans[idx].setAttribute('data-name', input.value);
                syncContentByColorAndName(spans[idx]);
            }
        });
    });
    markList.querySelectorAll('.mark-content-input').forEach(input => {
        input.addEventListener('input', function(e) {
            const markNumber = input.getAttribute('data-mark');
            const newText = input.value;
            const span = templateArea.querySelector(`span[data-mark="${markNumber}"]`);
            if (span) {
                span.textContent = newText;
                syncContentByColorAndName(span);
            }
        });
    });
    markList.querySelectorAll('.mark-content-select').forEach(select => {
        select.addEventListener('change', function(e) {
            const markNumber = select.getAttribute('data-mark');
            const newText = select.value;
            const span = templateArea.querySelector(`span[data-mark="${markNumber}"]`);
            if (span) {
                span.textContent = newText;
                syncContentByColorAndName(span);
            }
        });
        select.addEventListener('contextmenu', function(e) {
            if (select.value && select.value !== '') {
                e.preventDefault();
                const markNumber = select.getAttribute('data-mark');
                const span = templateArea.querySelector(`span[data-mark="${markNumber}"]`);
                const markName = span ? span.getAttribute('data-name') || '' : '';
                if (confirm(`確定要刪除選項「${select.value}」嗎？\n注意：這會從相同標記名稱的綠色標記選單中移除此選項。`)) {
                    const valueToRemove = select.value;
                    if (defaultOptions.green[markName]) {
                        const index = defaultOptions.green[markName].indexOf(valueToRemove);
                        if (index > -1) {
                            defaultOptions.green[markName].splice(index, 1);
                        }
                    }
                    document.querySelectorAll('.mark-content-select').forEach(sel => {
                        const selMarkNumber = sel.getAttribute('data-mark');
                        const selSpan = templateArea.querySelector(`span[data-mark="${selMarkNumber}"]`);
                        const selMarkName = selSpan ? selSpan.getAttribute('data-name') || '' : '';
                        if (selMarkName === markName) {
                            const optionToRemove = Array.from(sel.options).find(opt => opt.value === valueToRemove);
                            if (optionToRemove) {
                                sel.removeChild(optionToRemove);
                            }
                        }
                    });
                    if (select.value === valueToRemove) {
                        select.value = '';
                        if (span) {
                            span.textContent = '';
                        }
                    }
                }
            }
        });
    });
    markList.querySelectorAll('.add-option-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const wrapper = btn.closest('.mark-content-wrapper');
            const select = wrapper.querySelector('.mark-content-select');
            if (select) {
                const newOption = prompt('請輸入新的選項內容：');
                if (newOption && newOption.trim()) {
                    const markNumber = select.getAttribute('data-mark');
                    const span = templateArea.querySelector(`span[data-mark="${markNumber}"]`);
                    const markName = span ? span.getAttribute('data-name') || '' : '';
                    if (!defaultOptions.green[markName]) {
                        defaultOptions.green[markName] = [];
                    }
                    const exists = defaultOptions.green[markName].includes(newOption.trim());
                    if (!exists) {
                        defaultOptions.green[markName].push(newOption.trim());
                        document.querySelectorAll('.mark-content-select').forEach(sel => {
                            const selMarkNumber = sel.getAttribute('data-mark');
                            const selSpan = templateArea.querySelector(`span[data-mark="${selMarkNumber}"]`);
                            const selMarkName = selSpan ? selSpan.getAttribute('data-name') || '' : '';
                            if (selMarkName === markName) {
                                const opt = document.createElement('option');
                                opt.value = newOption.trim();
                                opt.textContent = newOption.trim();
                                sel.appendChild(opt);
                            }
                        });
                    }
                    select.value = newOption.trim();
                    if (span) {
                        span.textContent = newOption.trim();
                    }
                }
            }
        });
    });
    markList.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const markNumber = btn.getAttribute('data-mark');
            removeMarkByNumber(markNumber);
        });
    });
    markList.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const wrapper = btn.closest('.mark-content-wrapper');
            const input = wrapper.querySelector('.time-input');
            if (input) {
                const rawValue = input.value.trim();
                if (rawValue && /^\d+$/.test(rawValue)) {
                    const result = checkCrimeTime(rawValue);
                    const finalText = result.success ? result.text : rawValue;
                    input.value = finalText;
                    const markNumber = input.getAttribute('data-mark');
                    const span = templateArea.querySelector(`span[data-mark="${markNumber}"]`);
                    if (span) {
                        span.textContent = finalText;
                        syncContentByColorAndName(span);
                    }
                } else {
                    alert('請輸入純數字格式，如：112、11203、1120315');
                }
            }
        });
    });
}

function reorderMarks(fromIdx, toIdx) {
    const spans = Array.from(templateArea.querySelectorAll('span[data-mark]')).filter(span => {
        return span.parentNode && templateArea.contains(span);
    });
    spans.sort((a, b) => parseInt(a.getAttribute('data-mark')) - parseInt(b.getAttribute('data-mark')));
    if (fromIdx >= 0 && fromIdx < spans.length && toIdx >= 0 && toIdx < spans.length && fromIdx !== toIdx) {
        const newOrder = [...spans];
        const [movedSpan] = newOrder.splice(fromIdx, 1);
        newOrder.splice(toIdx, 0, movedSpan);
        newOrder.forEach((span, index) => {
            span.setAttribute('data-mark', index + 1);
        });
        renderMarkList();
    }
}

const observer = new MutationObserver(function(mutations) {
    let shouldUpdate = false;
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            mutation.removedNodes.forEach(function(node) {
                if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute && node.hasAttribute('data-mark')) {
                    shouldUpdate = true;
                }
            });
        }
    });
    if (shouldUpdate) {
        setTimeout(renderMarkList, 50);
    }
});

observer.observe(templateArea, {
    childList: true,
    subtree: true
});

templateArea.addEventListener('click', function(e) {
    const markSpan = e.target.closest('span[data-mark]');
    if (markSpan) {
        const markNumber = markSpan.getAttribute('data-mark');
        const markItems = markList.querySelectorAll('.mark-item');
        markItems.forEach(item => {
            const removeBtn = item.querySelector('.remove-btn');
            if (removeBtn && removeBtn.getAttribute('data-mark') === markNumber) {
                item.style.backgroundColor = '#e3f2fd';
                setTimeout(() => {
                    item.style.backgroundColor = '';
                }, 1000);
            }
        });
    }
});

templateArea.addEventListener('paste', function(e) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const markSpan = container.nodeType === Node.TEXT_NODE 
            ? container.parentNode 
            : container;
        if (markSpan.hasAttribute && markSpan.hasAttribute('data-mark')) {
            e.preventDefault();
            return false;
        }
    }
    setTimeout(renderMarkList, 100);
});

templateArea.addEventListener('copy', function(e) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        const spans = container.querySelectorAll('span[data-mark]');
        spans.forEach(span => {
            span.removeAttribute('data-mark');
            span.removeAttribute('contenteditable');
            span.className = 'mark-span';
        });
        e.clipboardData.setData('text/html', container.innerHTML);
        e.clipboardData.setData('text/plain', selection.toString());
        e.preventDefault();
    }
});

renderMarkList(); 