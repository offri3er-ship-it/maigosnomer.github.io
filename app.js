// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
let currentStream = null;
let usingFrontCamera = false;

// Элементы DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const resultContainer = document.getElementById('result-container');
const loadingElement = document.getElementById('loading');
const manualInput = document.getElementById('manual-input');

// Инициализация приложения
function init() {
    tg.expand();
    tg.enableClosingConfirmation();
    tg.BackButton.show();
    tg.BackButton.onClick(closeCamera);
    
    // Показать поле для ручного ввода
    manualInput.classList.remove('hidden');
    
    // Показать информацию о пользователе
    const user = tg.initDataUnsafe.user;
    const userDataElement = document.getElementById('user-data');
    
    if (user) {
        userDataElement.innerHTML = `
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Имя:</strong> ${user.first_name} ${user.last_name || ''}</p>
            <p><strong>Username:</strong> @${user.username || 'не указан'}</p>
        `;
    } else {
        userDataElement.innerHTML = '<p>Данные пользователя недоступны</p>';
    }
    
    console.log('Mini App инициализирован');
}

// Инициализация камеры
async function initCamera() {
    try {
        const constraints = {
            video: {
                facingMode: usingFrontCamera ? "user" : "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            }
        };
        
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        
        captureBtn.classList.remove('hidden');
        
    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        tg.showAlert('Не удалось получить доступ к камере. Проверьте разрешения.');
    }
}

// Переключение камеры
function switchCamera() {
    usingFrontCamera = !usingFrontCamera;
    initCamera();
}

// Закрыть камеру
function closeCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    video.srcObject = null;
    captureBtn.classList.add('hidden');
    tg.BackButton.hide();
}

// Сделать фото и распознать номер
captureBtn.addEventListener('click', function() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Показать индикатор загрузки
    loadingElement.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    
    // Распознавание текста с изображения
    recognizePlateFromImage(canvas);
});

// Распознавание номера с помощью Tesseract.js
async function recognizePlateFromImage(canvasElement) {
    try {
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
        
        loadingElement.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        
        document.getElementById('recognized-plate').innerHTML = `
            <strong>Распознанный номер:</strong> ${cleanedPlate}
        `;
        
        // Отправить номер в бот для получения информации
        sendPlateToBot(cleanedPlate);
        
    } catch (error) {
        console.error('Ошибка распознавания:', error);
        tg.showAlert('Ошибка при распознавании номера. Попробуйте еще раз.');
        loadingElement.classList.add('hidden');
    }
}

// Очистка распознанного текста
function cleanPlateText(text) {
    return text
        .replace(/[^ABEKMHOPCTYX0-9]/gi, '')
        .toUpperCase()
        .substring(0, 9);
}

// Обработка ручного ввода
function processManualInput() {
    const plateInput = document.getElementById('plate-input');
    const plateNumber = plateInput.value.trim().toUpperCase();
    
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
    
    loadingElement.classList.remove('hidden');
    resultContainer.classList.remove('hidden');
    
    document.getElementById('recognized-plate').innerHTML = `
        <strong>Введенный номер:</strong> ${plateNumber}
    `;
    
    sendPlateToBot(plateNumber);
}

// Отправка номера в бот
function sendPlateToBot(plateNumber) {
    const user = tg.initDataUnsafe.user;
    
    const data = {
        action: 'recognize_plate',
        plate_number: plateNumber,
        user_id: user?.id,
        username: user?.username,
        timestamp: new Date().toISOString()
    };
    
    // Отправляем данные в бот
    tg.sendData(JSON.stringify(data));
    
    // Показываем информацию о транспортном средстве (заглушка)
    document.getElementById('vehicle-info').innerHTML = `
        <p>🔍 Ищем информацию по номеру <strong>${plateNumber}</strong>...</p>
        <p>Данные будут отправлены в чат с ботом</p>
    `;
    
    // Закрываем мини-приложение через 3 секунды
    setTimeout(() => {
        tg.close();
    }, 3000);
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
