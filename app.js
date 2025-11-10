// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;

// Основная функция инициализации
function init() {
    tg.expand(); // Раскрыть на весь экран
    tg.enableClosingConfirmation(); // Подтверждение закрытия
    
    // Показать данные пользователя
    const user = tg.initDataUnsafe.user;
    const userDataElement = document.getElementById('user-data');
    
    if (user) {
        userDataElement.innerHTML = `
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Имя:</strong> ${user.first_name} ${user.last_name || ''}</p>
            <p><strong>Username:</strong> @${user.username || 'не указан'}</p>
            <p><strong>Язык:</strong> ${user.language_code || 'не указан'}</p>
        `;
    } else {
        userDataElement.innerHTML = '<p>Данные пользователя недоступны</p>';
    }
    
    // Применить тему Telegram
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
    document.body.style.color = tg.themeParams.text_color || '#000000';
}

// Функции для кнопок
function showAlert() {
    tg.showAlert('Привет от Mini App!');
}

function changeTheme() {
    const currentTheme = tg.colorScheme;
    if (currentTheme === 'dark') {
        tg.setHeaderColor('#ffffff');
        tg.setBackgroundColor('#ffffff');
    } else {
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
    }
}

function sendData() {
    const data = {
        action: 'test_data',
        timestamp: Date.now(),
        user_id: tg.initDataUnsafe.user?.id
    };
    
    tg.sendData(JSON.stringify(data));
    tg.showPopup({
        title: 'Успех!',
        message: 'Данные отправлены в бота',
        buttons: [{ type: 'ok' }]
    });
}

function saveText() {
    const input = document.getElementById('input-text');
    const text = input.value.trim();
    
    if (text) {
        tg.showPopup({
            title: 'Текст сохранен',
            message: `Вы ввели: ${text}`,
            buttons: [{ type: 'ok' }]
        });
        
        // Можно отправить данные в бота
        tg.sendData(JSON.stringify({ text: text }));
        input.value = '';
    } else {
        tg.showAlert('Введите текст!');
    }
}

// Обработчики событий Telegram
tg.onEvent('themeChanged', () => {
    document.body.style.backgroundColor = tg.themeParams.bg_color;
    document.body.style.color = tg.themeParams.text_color;
});

tg.onEvent('viewportChanged', () => {
    console.log('Viewport changed');
});

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', init);