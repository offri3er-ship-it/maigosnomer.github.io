class CarPlateChecker {
    constructor() {
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.initTelegram();
    }

    initializeElements() {
        // Элементы режимов
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.cameraMode = document.getElementById('cameraMode');
        this.manualMode = document.getElementById('manualMode');
        
        // Элементы камеры
        this.openCameraBtn = document.getElementById('openCamera');
        this.demoPlates = document.querySelectorAll('.demo-plate');
        
        // Элементы ручного ввода
        this.plateInput = document.getElementById('plateInput');
        this.checkButton = document.getElementById('checkButton');
        
        // Элементы результатов
        this.loading = document.getElementById('loading');
        this.result = document.getElementById('result');
        this.error = document.getElementById('error');
        this.screenshotContainer = document.getElementById('screenshotContainer');
        this.plateNumber = document.getElementById('plateNumber');
        this.newCheckButton = document.getElementById('newCheck');
        this.retryButton = document.getElementById('retryButton');
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
        }
    }

    bindEvents() {
        // Переключение режимов
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Демо-номера в режиме камеры
        this.demoPlates.forEach(plate => {
            plate.addEventListener('click', (e) => {
                const plateNumber = e.target.dataset.plate;
                this.checkAvtocod(plateNumber);
            });
        });

        // Кнопка открытия камеры (просто показывает сообщение)
        this.openCameraBtn.addEventListener('click', () => {
            this.showError('В Telegram Mini Apps камера недоступна. Используйте демо-номера или ручной ввод.');
        });

        // Ручной ввод
        this.checkButton.addEventListener('click', () => this.checkPlate());
        this.plateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkPlate();
        });
        
        this.plateInput.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            e.target.value = value;
        });

        // Общие
        this.newCheckButton.addEventListener('click', () => this.resetForm());
        this.retryButton.addEventListener('click', () => this.resetForm());
    }

    switchMode(mode) {
        this.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        this.cameraMode.classList.toggle('active', mode === 'camera');
        this.manualMode.classList.toggle('active', mode === 'manual');
    }

    validatePlate(plate) {
        if (!plate) return false;
        
        const patterns = [
            /^[АВЕКМНОРСТУХP]\d{3}[АВЕКМНОРСТУХP]{2}\d{2,3}$/,
            /^[АВЕКМНОРСТУХP]{2}\d{3}\d{2,3}$/,
            /^[АВЕКМНОРСТУХP]\d{2}[АВЕКМНОРСТУХP]{2}\d{2,3}$/,
        ];
        
        return patterns.some(pattern => pattern.test(plate));
    }

    checkPlate() {
        const plate = this.plateInput.value.trim();
        
        if (!this.validatePlate(plate)) {
            this.showError('Введите корректный госномер. Пример: А123АА777 или P594KC99');
            return;
        }

        this.checkAvtocod(plate);
    }

    async checkAvtocod(plate) {
        this.showLoading();
        
        // Имитация загрузки
        setTimeout(() => {
            try {
                const result = this.getAvtocodData(plate);
                this.showResult(plate, result);
            } catch (error) {
                console.error('Error:', error);
                this.showError('Не удалось получить данные. Попробуйте позже.');
            }
        }, 1500);
    }

    getAvtocodData(plate) {
        const avtocodUrl = `https://avtocod.ru/proverkaavto/${plate}`;
        
        // Демо-данные для разных номеров
        const demoData = {
            'А123АА777': {
                vin: 'XTA210990Y1234567',
                brand: 'LADA VESTA',
                year: '2022',
                color: 'Белый',
                engine: '1.6 л',
                power: '106 л.с.'
            },
            'Х970ХУ777': {
                vin: 'Z94CB41BAGR323456',
                brand: 'HYUNDAI SOLARIS',
                year: '2020',
                color: 'Серый',
                engine: '1.6 л',
                power: '123 л.с.'
            },
            'P594KC99': {
                vin: 'MMBJRCFU2HJ123456',
                brand: 'MERCEDES-BENZ',
                year: '2023',
                color: 'Черный',
                engine: '2.0 л',
                power: '184 л.с.'
            },
            'ЕКХ777': {
                vin: 'X9FPXXEEBDM123456',
                brand: 'FORD FOCUS',
                year: '2021',
                color: 'Синий',
                engine: '1.5 л',
                power: '150 л.с.'
            }
        };

        const data = demoData[plate] || {
            vin: 'Данные доступны по ссылке',
            brand: 'Откройте полный отчет',
            year: 'Для просмотра данных',
            color: 'перейдите по ссылке ниже',
            engine: '',
            power: ''
        };

        return {
            directUrl: avtocodUrl,
            ...data
        };
    }

    showLoading() {
        this.hideAll();
        this.loading.classList.remove('hidden');
    }

    showResult(plate, data) {
        this.hideAll();
        this.plateNumber.textContent = plate;
        
        let resultHTML = '';
        
        if (data.vin && data.vin !== 'Данные доступны по ссылке') {
            // Показываем демо-данные
            resultHTML = `
                <div class="parsed-data">
                    <div class="data-grid">
                        <div class="data-item">
                            <span class="label">VIN:</span>
                            <span class="value">${data.vin}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Марка:</span>
                            <span class="value">${data.brand}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Год:</span>
                            <span class="value">${data.year}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Цвет:</span>
                            <span class="value">${data.color}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Двигатель:</span>
                            <span class="value">${data.engine}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Мощность:</span>
                            <span class="value">${data.power}</span>
                        </div>
                    </div>
                    <div class="full-report">
                        <a href="${data.directUrl}" target="_blank" class="direct-link-btn">
                            📊 Полный отчет на Avtocod
                        </a>
                    </div>
                </div>
            `;
        } else {
            // Показываем только ссылку
            resultHTML = `
                <div class="direct-link">
                    <p>✅ Данные успешно получены!</p>
                    <p>Для просмотра полного отчета перейдите по ссылке:</p>
                    <a href="${data.directUrl}" target="_blank" class="direct-link-btn">
                        📊 Открыть полный отчет на Avtocod
                    </a>
                    <div class="link-info">
                        <small>Ссылка откроется в браузере с полными данными об автомобиле ${plate}</small>
                    </div>
                </div>
            `;
        }
        
        this.screenshotContainer.innerHTML = resultHTML;
        this.result.classList.remove('hidden');
    }

    showError(message) {
        this.hideAll();
        this.error.querySelector('p').textContent = message;
        this.error.classList.remove('hidden');
    }

    hideAll() {
        this.loading.classList.add('hidden');
        this.result.classList.add('hidden');
        this.error.classList.add('hidden');
    }

    resetForm() {
        this.hideAll();
        this.plateInput.value = '';
        this.switchMode('camera');
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CarPlateChecker();
});
