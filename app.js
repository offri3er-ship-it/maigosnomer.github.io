// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
let currentStream = null;
let usingFrontCamera = false;
let isCameraActive = false;

// Элементы DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const resultContainer = document.getElementById('result-container');
const loadingElement = document.getElementById('loading');
const manualInput = document.getElementById('manual-input');
const cameraContainer = document.getElementById('camera-container');

// Конфигурация
const CONFIG = {
    EXTERNAL_BOT_USERNAME: 'GH_800_bot', // Замените на username вашего бота
    REQUEST_TIMEOUT: 10000, // 10 секунд
    MAX_RETRIES: 3
};

// Инициализация приложения
function init() {
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Показать информацию о пользователе
    const user = tg.initDataUnsafe.user;
    const userDataElement = document.getElementById('user-data');
    
    if (user) {
        userDataElement.innerHTML = `
            <div class="user-data">
                <p><strong>ID:</strong> ${user.id}</p>
                <p><strong>Имя:</strong> ${user.first_name} ${user.last_name || ''}</p>
                <p><strong>Username:</strong> @${user.username || 'не указан'}</p>
            </div>
        `;
    } else {
        userDataElement.innerHTML = '<div class="user-data"><p>Данные пользователя недоступны</p></div>';
    }
    
    console.log('Mini App инициализирован');
    
    // Проверить поддержку камеры
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError('Ваш браузер не поддерживает камеру');
    }
}

// Показать ошибку камеры
function showCameraError(message) {
    const cameraSection = document.querySelector('.card:nth-child(2)');
    cameraSection.innerHTML = `
        <h3>📷 Сфотографируйте автомобильный номер</h3>
        <div style="text-align: center; padding: 20px; color: #dc3545;">
            <p>❌ ${message}</p>
            <p>Используйте ручной ввод номера</p>
        </div>
    `;
}

// Инициализация камеры
async function initCamera() {
    try {
        if (isCameraActive) {
            closeCamera();
            return;
        }

        console.log('Пытаемся включить камеру...');
        
        const constraints = {
            video: {
                facingMode: usingFrontCamera ? "user" : "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        // Останавливаем предыдущий поток
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        // Показываем сообщение о загрузке камеры
        const cameraControls = document.getElementById('camera-controls');
        cameraControls.innerHTML = '<p>🔄 Загружаем камеру...</p>';
        
        // Получаем доступ к камере
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        
        // Ждем пока видео загрузится
        video.onloadedmetadata = function() {
            console.log('Камера успешно загружена');
            
            // Показываем видео и кнопку захвата
            video.style.display = 'block';
            captureBtn.style.display = 'block';
            cameraContainer.style.display = 'block';
            
            // Обновляем кнопки управления
            cameraControls.innerHTML = `
                <button class="btn secondary" onclick="switchCamera()">🔄 Переключить камеру</button>
                <button class="btn secondary" onclick="closeCamera()">❌ Выключить камеру</button>
            `;
            
            isCameraActive = true;
        };
        
        video.onerror = function() {
            console.error('Ошибка загрузки видео');
            showCameraError('Ошибка загрузки камеры');
        };

    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        
        let errorMessage = 'Не удалось получить доступ к камере. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Разрешите доступ к камере в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Камера не найдена на устройстве.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Ваш браузер не поддерживает камеру.';
        } else {
            errorMessage += 'Попробуйте использовать ручной ввод.';
        }
        
        showCameraError(errorMessage);
    }
}

// Переключение камеры
function switchCamera() {
    usingFrontCamera = !usingFrontCamera;
    closeCamera();
    setTimeout(initCamera, 500);
}

// Закрыть камеру
function closeCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    video.srcObject = null;
    video.style.display = 'none';
    captureBtn.style.display = 'none';
    cameraContainer.style.display = 'none';
    isCameraActive = false;
    
    // Восстанавливаем кнопку включения камеры
    const cameraControls = document.getElementById('camera-controls');
    cameraControls.innerHTML = `
        <button class="btn primary" onclick="initCamera()">🎥 Включить камеру</button>
        <button class="btn secondary" onclick="switchCamera()">🔄 Переключить камеру</button>
    `;
}

// Сделать фото и распознать номер
captureBtn.addEventListener('click', function() {
    if (!isCameraActive) return;
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Показать индикатор загрузки
    showLoading(true);
    hideResult();
    
    // Распознавание текста с изображения
    recognizePlateFromImage(canvas);
});

// Распознавание номера с помощью Tesseract.js
async function recognizePlateFromImage(canvasElement) {
    try {
        showLoading(true);
        
        const worker = await Tesseract.createWorker('rus', 1, {
            logger: m => console.log(m)
        });
        
        await worker.setParameters({
            tessedit_char_whitelist: 'ABEKMHOPCTYX0123456789',
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE
        });
        
        const { data: { text } } = await worker.recognize(canvasElement);
        await worker.terminate();
        
        const cleanedPlate = cleanPlateText(text);
        
        showLoading(false);
        processPlateNumber(cleanedPlate, true);
        
    } catch (error) {
        console.error('Ошибка распознавания:', error);
        tg.showAlert('Ошибка при распознавании номера. Попробуйте еще раз.');
        showLoading(false);
    }
}

// Очистка распознанного текста
function cleanPlateText(text) {
    return text
        .replace(/[^ABEKMHOPCTYX0-9]/gi, '')
        .toUpperCase()
        .substring(0, 9);
}

// Автоматическое форматирование при вводе
function formatPlateInput(input) {
    let value = input.value;
    
    // Конвертируем русские буквы в английские для унификации
    value = value.toUpperCase()
        .replace(/[АВЕКМНОРСТУХ]/g, function(match) {
            const mapping = {
                'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M',
                'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T',
                'У': 'Y', 'Х': 'X'
            };
            return mapping[match] || match;
        });
    
    // Оставляем только разрешенные символы
    value = value.replace(/[^ABEKMHOPCTYX0-9]/g, '');
    
    // Ограничиваем длину
    value = value.substring(0, 9);
    
    input.value = value;
}

// Обработка ручного ввода
function processManualInput() {
    const plateInput = document.getElementById('plate-input');
    let plateNumber = plateInput.value.trim();
    
    // Конвертируем русские буквы в английские для унификации
    plateNumber = plateNumber.toUpperCase()
        .replace(/[АВЕКМНОРСТУХ]/g, function(match) {
            const mapping = {
                'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M',
                'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T',
                'У': 'Y', 'Х': 'X'
            };
            return mapping[match] || match;
        });
    
    if (!plateNumber) {
        tg.showAlert('Введите номер автомобиля');
        return;
    }
    
    // Валидация российского номерного знака
    const plateRegex = /^[ABEKMHOPCTYX]{1}\d{3}[ABEKMHOPCTYX]{2}\d{2,3}$/;
    if (!plateRegex.test(plateNumber)) {
        tg.showAlert('Неверный формат номера. Пример: А123БВ777');
        return;
    }
    
    processPlateNumber(plateNumber, false);
}

// Основная функция обработки номера
function processPlateNumber(plateNumber, fromCamera) {
    const source = fromCamera ? 'распознан камерой' : 'введен вручную';
    
    // Показываем начальный результат
    showInitialResult(plateNumber, source);
    
    // Запрашиваем данные у внешнего бота
    requestVehicleInfo(plateNumber);
}

// Показ начального результата
function showInitialResult(plateNumber, source) {
    document.getElementById('recognized-plate').innerHTML = `
        <div class="result-item">
            <strong>Номер ${source}:</strong> ${plateNumber}
        </div>
    `;
    
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <div class="loading">
                <div class="spinner"></div>
                <p>🔍 <strong>Запрашиваем информацию у внешнего сервиса...</strong></p>
                <p>Это может занять несколько секунд</p>
            </div>
        </div>
    `;
    
    showResultContainer();
}

// Запрос информации у внешнего бота
async function requestVehicleInfo(plateNumber) {
    try {
        console.log('Запрашиваем информацию для номера:', plateNumber);
        
        // Вариант 1: Прямой запрос к API (если у бота есть API)
        // const vehicleInfo = await fetchFromExternalAPI(plateNumber);
        
        // Вариант 2: Имитация запроса через Telegram
        const vehicleInfo = await simulateExternalBotRequest(plateNumber);
        
        // Показываем результат
        showVehicleInfo(plateNumber, vehicleInfo);
        
    } catch (error) {
        console.error('Ошибка запроса информации:', error);
        showErrorResult(plateNumber, 'Не удалось получить информацию от внешнего сервиса');
    }
}

// Имитация запроса к внешнему боту
async function simulateExternalBotRequest(plateNumber) {
    return new Promise((resolve) => {
        // Имитируем задержку запроса
        setTimeout(() => {
            // Демо-данные (замените на реальный запрос к вашему боту)
            const demoData = {
                'А123БВ777': {
                    brand: 'Toyota',
                    model: 'Camry',
                    year: '2020',
                    color: 'Черный',
                    vin: '6T123456789012345',
                    engine: '2.5L',
                    power: '181 л.с.',
                    owner: 'Иванов И.И.',
                    status: 'Не в розыске',
                    insurance: 'Действует до 12.12.2024',
                    accidents: 'Не участвовал',
                    restrictions: 'Нет ограничений'
                },
                'О777ОО177': {
                    brand: 'BMW',
                    model: 'X5',
                    year: '2019',
                    color: 'Белый',
                    vin: 'WBA12345678901234',
                    engine: '3.0L',
                    power: '249 л.с.',
                    owner: 'Петров П.П.',
                    status: 'Не в розыске',
                    insurance: 'Действует до 15.03.2025',
                    accidents: 'Не участвовал',
                    restrictions: 'Нет ограничений'
                }
            };
            
            if (demoData[plateNumber]) {
                resolve({
                    success: true,
                    data: demoData[plateNumber],
                    source: 'Внешний сервис'
                });
            } else {
                resolve({
                    success: false,
                    error: 'Номер не найден в базе данных',
                    source: 'Внешний сервис'
                });
            }
        }, 2000); // Имитация задержки сети
    });
}

// Показ информации об автомобиле
function showVehicleInfo(plateNumber, response) {
    if (!response.success) {
        showErrorResult(plateNumber, response.error);
        return;
    }
    
    const info = response.data;
    
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <h4>🚗 Информация об автомобиле</h4>
            <div style="background: #000; color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 10px 0; font-family: monospace; font-size: 20px; font-weight: bold;">
                ${plateNumber}
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Марка:</span>
                    <span class="info-value">${info.brand}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Модель:</span>
                    <span class="info-value">${info.model}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Год:</span>
                    <span class="info-value">${info.year}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Цвет:</span>
                    <span class="info-value">${info.color}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Двигатель:</span>
                    <span class="info-value">${info.engine}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Мощность:</span>
                    <span class="info-value">${info.power}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">VIN:</span>
                    <span class="info-value" style="font-family: monospace;">${info.vin}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Владелец:</span>
                    <span class="info-value">${info.owner}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Статус:</span>
                    <span class="info-value" style="color: #28a745;">${info.status}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Страховка:</span>
                    <span class="info-value">${info.insurance}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ДТП:</span>
                    <span class="info-value">${info.accidents}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Ограничения:</span>
                    <span class="info-value">${info.restrictions}</span>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px;">
                <small>Источник: ${response.source} • ${new Date().toLocaleString('ru-RU')}</small>
            </div>
        </div>
        
        <div class="result-item">
            <button class="btn primary" onclick="openInExternalBot('${plateNumber}')">
                📱 Открыть в основном боте
            </button>
            <button class="btn secondary" onclick="resetScanner()">
                🔄 Новый поиск
            </button>
        </div>
    `;
}

// Показ ошибки
function showErrorResult(plateNumber, errorMessage) {
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <div style="text-align: center; padding: 20px; color: #dc3545;">
                <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
                <h4>Информация не найдена</h4>
                <p>${errorMessage}</p>
                <p>Номер: <strong>${plateNumber}</strong></p>
            </div>
            
            <div style="margin-top: 15px;">
                <button class="btn primary" onclick="openInExternalBot('${plateNumber}')">
                    📱 Попробовать в основном боте
                </button>
                <button class="btn secondary" onclick="resetScanner()">
                    🔄 Новый поиск
                </button>
            </div>
        </div>
    `;
}

// Открыть в основном боте
function openInExternalBot(plateNumber) {
    const botUsername = CONFIG.EXTERNAL_BOT_USERNAME;
    const url = `https://t.me/${botUsername}?start=plate_${plateNumber}`;
    
    // Открываем бота
    tg.openTelegramLink(url);
    
    // Закрываем мини-приложение
    setTimeout(() => {
        tg.close();
    }, 1000);
}

// Сброс сканера
function resetScanner() {
    closeCamera();
    const plateInput = document.getElementById('plate-input');
    plateInput.value = '';
    resultContainer.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Вспомогательные функции
function showLoading(show) {
    if (show) {
        loadingElement.classList.remove('hidden');
    } else {
        loadingElement.classList.add('hidden');
    }
}

function showResultContainer() {
    resultContainer.classList.remove('hidden');
}

function hideResult() {
    resultContainer.classList.add('hidden');
}

// Обработчики событий Telegram
tg.onEvent('themeChanged', updateTheme);
tg.onEvent('viewportChanged', () => console.log('Viewport changed'));

function updateTheme() {
    document.body.style.backgroundColor = tg.themeParams.bg_color;
    document.body.style.color = tg.themeParams.text_color;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', init);
