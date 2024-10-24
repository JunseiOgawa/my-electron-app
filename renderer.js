document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('timeline');
    const ctx = canvas.getContext('2d');
    const moveLeftButton = document.getElementById('moveLeft');
    const moveRightButton = document.getElementById('moveRight');
    const addLayerButton = document.getElementById('addLayer');
    const removeLayerButton = document.getElementById('removeLayer');
    const scale5minButton = document.getElementById('scale5min');
    const scale30minButton = document.getElementById('scale30min');
    const scale1hourButton = document.getElementById('scale1hour');
    const dateElement = document.getElementById('date');
    const calendarTable = document.getElementById('calendarTable');
    const timelineContainer = document.getElementById('timeline-container');

    let boxes = [];
    let layerCount = 5;
    let timelineOffset = 0;
    let dragging = false;
    let dragIndex = -1;
    let timeScale = 30; // デフォルトは30分間隔
    let moveInterval;//矢印のオフセット移動を定期更新して長押し動作用

    const TOTAL_MINUTES = 24 * 60; // 24時間分の総分数
    let intervalWidth; // グローバル変数
    let TOTAL_TIMELINE_WIDTH; // グローバル変数
    

    // タイムラインの表示設定
    const VIEW_WIDTH = 800; // キャンバスの表示幅
    const TIMELINE_PADDING = 40; // 左右のパディング
    
    function updateDate() {
        const now = new Date();
        dateElement.innerText = now.toLocaleString();
    }

    setInterval(updateDate, 1000);

    function startMovingLeft() {
        moveInterval = setInterval(() => {
            const maxOffset = TOTAL_TIMELINE_WIDTH - VIEW_WIDTH;
            if (timelineOffset < maxOffset) {
                timelineOffset += 50;
                drawTimeline();
            }
        }, 500);
    }
    
    function startMovingRight() {
        moveInterval = setInterval(() => {
            if (timelineOffset > 0) {
                timelineOffset -= 50;
                drawTimeline();
            }
        }, 500);
    }

    function stopMoving() {
        clearInterval(moveInterval);
    }

    moveLeftButton.addEventListener('mousedown', startMovingLeft);
    moveRightButton.addEventListener('mousedown', startMovingRight);
    moveLeftButton.addEventListener('mouseup', stopMoving);
    moveRightButton.addEventListener('mouseup', stopMoving);

    // ボタンの外にマウスが出ても止まるようにする
    document.addEventListener('mouseup', stopMoving);

    function initLayers() {
        boxes = [];
        for (let i = 0; i < layerCount; i++) {
            boxes.push({ 
                x: TIMELINE_PADDING, 
                y: 60 + i * 60, 
                width: 100, 
                height: 50, 
                color: getRandomColor() 
            });
        }
    }

    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    function drawTimeIntervals() {
        const minutesPerDay = TOTAL_MINUTES; // 24時間分の分数
        const intervalCount = minutesPerDay / timeScale;
        intervalWidth = (VIEW_WIDTH - (TIMELINE_PADDING * 2)) / intervalCount; // グローバル変数に設定
        TOTAL_TIMELINE_WIDTH = minutesPerDay * intervalWidth; // グローバル変数に設定
        ctx.save();
        ctx.beginPath();
        ctx.rect(TIMELINE_PADDING, 0, VIEW_WIDTH - (TIMELINE_PADDING * 2), canvas.height);
        ctx.clip();
        for (let i = 0; i <= intervalCount; i++) {
            const x = TIMELINE_PADDING + (i * intervalWidth) + timelineOffset;
            if (x >= TIMELINE_PADDING && x <= VIEW_WIDTH - TIMELINE_PADDING) {
                ctx.beginPath();
                ctx.moveTo(x, 20);
                ctx.lineTo(x, canvas.height);
                ctx.strokeStyle = '#ccc';
                ctx.stroke();
                const minutes = i * timeScale;
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                const timeLabel = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                ctx.fillStyle = '#000';
                ctx.font = '12px Arial';
                ctx.fillText(timeLabel, x - 20, 15);
            }
        }
        ctx.restore();
    }    

    function initTimeline() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 外側の領域を暗くする
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, TIMELINE_PADDING, canvas.height);
        ctx.fillRect(VIEW_WIDTH - TIMELINE_PADDING, 0, TIMELINE_PADDING, canvas.height);

        drawTimeIntervals();
    }

    function drawBoxes() {
        ctx.save();
        // クリッピング領域の設定
        ctx.beginPath();
        ctx.rect(TIMELINE_PADDING, 0, VIEW_WIDTH - (TIMELINE_PADDING * 1), canvas.height);
        ctx.clip();

        boxes.forEach(box => {
            const xPos = box.x + timelineOffset;
            if (xPos + box.width >= TIMELINE_PADDING && xPos <= VIEW_WIDTH - TIMELINE_PADDING) {
                ctx.fillStyle = box.color;
                ctx.fillRect(xPos, box.y, box.width, box.height);
            }
        });
        ctx.restore();
    }

    function drawTimeline() {
        initTimeline();
        drawBoxes();
    }

    function updateScaleButtons() {
        const scaleButtons = [scale5minButton, scale30minButton, scale1hourButton];
        const scaleValues = [5, 30, 60];
        
        scaleButtons.forEach((button, index) => {
            if (timeScale === scaleValues[index]) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // スケール変更ボタンのイベントリスナーを更新
    scale5minButton.addEventListener('click', () => {
        timeScale = 5;
        updateScaleButtons();
        drawTimeline();
    });

    scale30minButton.addEventListener('click', () => {
        timeScale = 30;
        updateScaleButtons();
        drawTimeline();
    });

    scale1hourButton.addEventListener('click', () => {
        timeScale = 60;
        updateScaleButtons();
        drawTimeline();
    });

    // 初期化時にデフォルトのスケールボタンをアクティブに
    updateScaleButtons();

    // イベントリスナー
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x > TIMELINE_PADDING && x < VIEW_WIDTH - TIMELINE_PADDING) {
            boxes.forEach((box, index) => {
                const boxX = box.x + timelineOffset;
                if (x > boxX && x < boxX + box.width && y > box.y && y < box.y + box.height) {
                    dragging = true;
                    dragIndex = index;
                }
            });
        }
    });

    canvas.addEventListener('mouseup', () => {
        dragging = false;
        dragIndex = -1;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (dragging && dragIndex !== -1) {
            const rect = canvas.getBoundingClientRect();
            let newX = e.clientX - rect.left - boxes[dragIndex].width / 2 - timelineOffset;
            
            // ドラッグ範囲の制限
            if (newX < TIMELINE_PADDING) newX = TIMELINE_PADDING;
            if (newX > VIEW_WIDTH - TIMELINE_PADDING - boxes[dragIndex].width) {
                newX = VIEW_WIDTH - TIMELINE_PADDING - boxes[dragIndex].width;
            }
            
            boxes[dragIndex].x = newX;
            drawTimeline();
        }
    });

    // スケール変更ボタンのイベントリスナー
    scale5minButton.addEventListener('click', () => {
        timeScale = 5;
        drawTimeline();
    });

    scale30minButton.addEventListener('click', () => {
        timeScale = 30;
        drawTimeline();
    });

    scale1hourButton.addEventListener('click', () => {
        timeScale = 60;
        drawTimeline();
    });

    moveLeftButton.addEventListener('click', () => {
        timelineOffset += 50;
        drawTimeline();
    });

    moveRightButton.addEventListener('click', () => {
        timelineOffset -= 50;
        drawTimeline();
    });

    addLayerButton.addEventListener('click', () => {
        layerCount++;
        boxes.push({ 
            x: TIMELINE_PADDING, 
            y: 60 + (layerCount - 1) * 60, 
            width: 100, 
            height: 50, 
            color: getRandomColor() 
        });
        drawTimeline();
    });

    removeLayerButton.addEventListener('click', () => {
        if (layerCount > 1) {
            boxes.pop();
            layerCount--;
            drawTimeline();
        }
    });

    function createCalendar() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        let table = '<tr>';
        const days = ['日', '月', '火', '水', '木', '金', '土'];

        for (let i = 0; i < days.length; i++) {
            table += '<th>' + days[i] + '</th>';
        }
        table += '</tr><tr>';

        for (let i = 0; i < firstDay; i++) {
            table += '<td></td>';
        }

        for (let date = 1; date <= lastDate; date++) {
            if ((firstDay + date - 1) % 7 == 0) {
                table += '</tr><tr>';
            }
            table += '<td>' + date + '</td>';
        }

        table += '</tr>';
        calendarTable.innerHTML = table;
    }

    createCalendar();
    initLayers();
    drawTimeline();
    updateDate();
});