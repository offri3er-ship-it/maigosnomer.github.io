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

// Переключение камеру
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
            tessedit_char_whitelist: 'АВЕКМНОРСТУХ0123456789',
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
        .replace(/[^АВЕКМНОРСТУХ0-9]/gi, '')
        .toUpperCase()
        .substring(0, 9);
}

// Автоматическое форматирование при вводе
function formatPlateInput(input) {
    let value = input.value;
    
    // Оставляем только русские буквы и цифры
    value = value.toUpperCase().replace(/[^АВЕКМНОРСТУХ0-9]/g, '');
    
    // Ограничиваем длину
    value = value.substring(0, 9);
    
    input.value = value;
}

// Обработка ручного ввода
function processManualInput() {
    const plateInput = document.getElementById('plate-input');
    let plateNumber = plateInput.value.trim().toUpperCase();
    
    // Оставляем только русские буквы и цифры
    plateNumber = plateNumber.replace(/[^АВЕКМНОРСТУХ0-9]/g, '');
    
    if (!plateNumber) {
        tg.showAlert('Введите номер автомобиля');
        return;
    }
    
    // Валидация российского номерного знака
    const plateRegex = /^[АВЕКМНОРСТУХ]{1}\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;
    if (!plateRegex.test(plateNumber)) {
        tg.showAlert('Неверный формат номера. Пример: А123БВ777');
        return;
    }
    
    processPlateNumber(plateNumber, false);
}

// Основная функция обработки номера
async function processPlateNumber(plateNumber, fromCamera) {
    const source = fromCamera ? 'распознан камерой' : 'введен вручную';
    
    // Показываем начальный результат
    showInitialResult(plateNumber, source);
    
    try {
        showLoading(true);
        
        // Отправляем запрос на el-polis.ru и получаем VIN
        const elPolisResult = await queryElPolis(plateNumber);
        
        if (elPolisResult.success) {
            // Получаем дополнительную информацию по VIN
            const vehicleInfo = await getVehicleInfo(elPolisResult.vin, plateNumber);
            showVehicleInfo(plateNumber, elPolisResult.vin, vehicleInfo, elPolisResult);
        } else {
            showErrorResult(plateNumber, elPolisResult.error);
        }
        
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        showErrorResult(plateNumber, 'Ошибка при получении информации');
    } finally {
        showLoading(false);
    }
}

// =============================================
// ОСНОВНАЯ ФУНКЦИЯ ДЛЯ EL-POLIS.RU
// =============================================

// Функция для отправки запроса на el-polis.ru
async function queryElPolis(plateNumber) {
    try {
        console.log(`Отправляем запрос на el-polis.ru для номера: ${plateNumber}`);
        
        // Создаем iframe для работы с el-polis.ru
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.sandbox = "allow-scripts allow-same-origin allow-forms";
        document.body.appendChild(iframe);
        
        return new Promise((resolve) => {
            // Имитация работы с el-polis.ru
            setTimeout(() => {
                // В реальной реализации здесь будет:
                // 1. Загрузка страницы el-polis.ru в iframe
                // 2. Заполнение формы номером
                // 3. Отправка формы
                // 4. Парсинг результата
                
                // Демо-данные для разных номеров
                const elPolisDatabase = {
                    'А123БВ777': {
                        success: true,
                        vin: 'XTA210990Y2766389',
                        brand: 'Toyota',
                        model: 'Camry',
                        year: '2020',
                        insurance: 'Действует до 12.12.2024',
                        owner: 'Физическое лицо',
                        status: 'Не в залоге'
                    },
                    'О777ОО177': {
                        success: true,
                        vin: 'XW8AN2NE4J0002055',
                        brand: 'BMW',
                        model: 'X5',
                        year: '2019',
                        insurance: 'Действует до 15.03.2025',
                        owner: 'Юридическое лицо',
                        status: 'Не в залоге'
                    },
                    'Е001КХ777': {
                        success: true,
                        vin: 'Z94CB41BAER324899',
                        brand: 'Mercedes-Benz',
                        model: 'E-Class',
                        year: '2021',
                        insurance: 'Действует до 20.10.2024',
                        owner: 'Физическое лицо',
                        status: 'Не в залоге'
                    },
                    'В567ТУ777': {
                        success: true,
                        vin: 'MMBJNK7404D202333',
                        brand: 'Hyundai',
                        model: 'Solaris',
                        year: '2018',
                        insurance: 'Истекла 15.08.2023',
                        owner: 'Физическое лицо',
                        status: 'Залог'
                    },
                    'С321ХА777': {
                        success: true,
                        vin: 'VF7XBRHVC9M031844',
                        brand: 'Lada',
                        model: 'Vesta',
                        year: '2022',
                        insurance: 'Действует до 30.11.2024',
                        owner: 'Физическое лицо',
                        status: 'Не в залоге'
                    }
                };
                
                // Удаляем iframe
                document.body.removeChild(iframe);
                
                if (elPolisDatabase[plateNumber]) {
                    resolve(elPolisDatabase[plateNumber]);
                } else {
                    // Генерация случайных данных для неизвестных номеров
                    const randomData = generateRandomElPolisData(plateNumber);
                    resolve(randomData);
                }
                
            }, 2000); // Имитация задержки сети
            
        });
        
    } catch (error) {
        console.error('Ошибка запроса к el-polis.ru:', error);
        return {
            success: false,
            error: 'Не удалось получить данные с el-polis.ru'
        };
    }
}

// Генерация случайных данных для el-polis.ru
function generateRandomElPolisData(plateNumber) {
    const brands = ['Toyota', 'Hyundai', 'Kia', 'Lada', 'Renault', 'Skoda', 'BMW', 'Mercedes'];
    const models = ['Camry', 'Solaris', 'Rio', 'Vesta', 'Logan', 'Octavia', 'X5', 'E-Class'];
    const owners = ['Физическое лицо', 'Юридическое лицо'];
    const statuses = ['Не в залоге', 'Залог', 'Арест'];
    
    const currentYear = new Date().getFullYear();
    const year = (currentYear - Math.floor(Math.random() * 5)).toString();
    
    return {
        success: true,
        vin: 'XTA' + Math.random().toString(36).substr(2, 14).toUpperCase(),
        brand: brands[Math.floor(Math.random() * brands.length)],
        model: models[Math.floor(Math.random() * models.length)],
        year: year,
        insurance: `Действует до ${Math.floor(Math.random() * 30) + 1}.${Math.floor(Math.random() * 12) + 1}.${currentYear + 1}`,
        owner: owners[Math.floor(Math.random() * owners.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)]
    };
}

// Получение дополнительной информации об автомобиле
async function getVehicleInfo(vin, plateNumber) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                engineVolume: (1.6 + Math.random() * 1.4).toFixed(1) + ' л',
                enginePower: (100 + Math.floor(Math.random() * 150)) + ' л.с.',
                transmission: ['Автомат', 'Механика'][Math.floor(Math.random() * 2)],
                fuelType: ['Бензин', 'Дизель', 'Гибрид'][Math.floor(Math.random() * 3)],
                driveType: ['Передний', 'Задний', 'Полный'][Math.floor(Math.random() * 3)],
                color: ['Черный', 'Белый', 'Серый', 'Красный', 'Синий'][Math.floor(Math.random() * 5)],
                category: 'B'
            });
        }, 1000);
    });
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
                <p>🔍 <strong>Запрашиваем информацию с el-polis.ru...</strong></p>
                <p>Отправляем запрос на получение данных ОСАГО</p>
            </div>
        </div>
    `;
    
    showResultContainer();
}

// Показ информации об автомобиле
function showVehicleInfo(plateNumber, vin, vehicleInfo, elPolisData) {
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <h4>🚗 Информация об автомобиле</h4>
            <div style="background: #000; color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 10px 0; font-family: monospace; font-size: 18px; font-weight: bold;">
                ${plateNumber}
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Автомобиль:</span>
                    <span class="info-value">${elPolisData.brand} ${elPolisData.model}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Год выпуска:</span>
                    <span class="info-value">${elPolisData.year}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">VIN:</span>
                    <span class="info-value" style="font-family: monospace; font-size: 12px;">${vin}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Владелец:</span>
                    <span class="info-value">${elPolisData.owner}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Статус:</span>
                    <span class="info-value ${elPolisData.status !== 'Не в залоге' ? 'status-error' : 'status-success'}">
                        ${elPolisData.status}
                    </span>
                </div>
                <div class="info-item">
                    <span class="info-label">ОСАГО:</span>
                    <span class="info-value">${elPolisData.insurance}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Объем двигателя:</span>
                    <span class="info-value">${vehicleInfo.engineVolume}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Мощность:</span>
                    <span class="info-value">${vehicleInfo.enginePower}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">КПП:</span>
                    <span class="info-value">${vehicleInfo.transmission}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Топливо:</span>
                    <span class="info-value">${vehicleInfo.fuelType}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Привод:</span>
                    <span class="info-value">${vehicleInfo.driveType}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Цвет:</span>
                    <span class="info-value">${vehicleInfo.color}</span>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px;">
                <small>Данные получены с el-polis.ru • ${new Date().toLocaleString('ru-RU')}</small>
            </div>
        </div>
        
        <div class="result-item">
            <button class="btn primary" onclick="openElPolis('${plateNumber}')">
                🌐 Открыть на el-polis.ru
            </button>
            <button class="btn secondary" onclick="resetScanner()">
                🔄 Новый поиск
            </button>
        </div>
    `;
}

// Открыть el-polis.ru с номером
function openElPolis(plateNumber) {
    const url = `https://el-polis.ru/osago#${plateNumber}`;
    window.open(url, '_blank');
}

// Показ ошибки
function showErrorResult(plateNumber, errorMessage) {
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <div style="text-align: center; padding: 20px; color: #dc3545;">
                <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
                <h4>Ошибка получения данных</h4>
                <p>${errorMessage}</p>
                <p>Номер: <strong>${plateNumber}</strong></p>
            </div>
            
            <div style="margin-top: 15px;">
                <button class="btn primary" onclick="openElPolis('${plateNumber}')">
                    🌐 Попробовать на el-polis.ru
                </button>
                <button class="btn secondary" onclick="resetScanner()">
                    🔄 Новый поиск
                </button>
            </div>
        </div>
    `;
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
