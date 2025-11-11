class CarPlateChecker {
    constructor() {
        this.init();
    }

    init() {
        this.plateInput = document.getElementById('plateInput');
        this.checkButton = document.getElementById('checkButton');
        this.loading = document.getElementById('loading');
        this.result = document.getElementById('result');
        this.error = document.getElementById('error');
        this.screenshotContainer = document.getElementById('screenshotContainer');
        this.plateNumber = document.getElementById('plateNumber');
        this.newCheckButton = document.getElementById('newCheck');
        this.retryButton = document.getElementById('retryButton');

        this.bindEvents();
        this.initTelegram();
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
        }
    }

    bindEvents() {
        this.checkButton.addEventListener('click', () => this.checkPlate());
        this.plateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkPlate();
            }
        });
        
        this.plateInput.addEventListener('input', (e) => {
            // Автоматическое форматирование номера
            let value = e.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            e.target.value = value;
        });

        this.newCheckButton.addEventListener('click', () => this.resetForm());
        this.retryButton.addEventListener('click', () => this.resetForm());
    }

    async checkPlate() {
        const plate = this.plateInput.value.trim();
        
        if (!this.validatePlate(plate)) {
            this.showError('Введите корректный госномер');
            return;
        }

        this.showLoading();
        
        try {
            const result = await this.getAvtocodData(plate);
            this.showResult(plate, result);
        } catch (error) {
            console.error('Error:', error);
            this.showError('Не удалось получить данные. Попробуйте позже.');
        }
    }

    validatePlate(plate) {
        if (!plate) return false;
        
        // Основные форматы российских номеров
        const patterns = [
            /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/, // Стандартный
            /^[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}$/, // Две буквы в начале
            /^[АВЕКМНОРСТУХ]{2}\d{4}\d{2,3}$/, // Такси
            /^\d{4}[АВЕКМНОРСТУХ]{2}\d{2,3}$/  // Номера прицепов
        ];
        
        return patterns.some(pattern => pattern.test(plate));
    }

    async getAvtocodData(plate) {
        // Формируем URL для Avtocod
        const avtocodUrl = `https://avtocod.ru/proverkaavto/${plate}`;
        
        // Используем CORS proxy для обхода ограничений
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const targetUrl = encodeURIComponent(avtocodUrl);
        
        try {
            const response = await fetch(proxyUrl + targetUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();
            return this.extractDataFromHTML(html, plate);
            
        } catch (error) {
            // Если не удалось получить данные через proxy, показываем ссылку
            console.warn('Proxy failed, showing direct link');
            return {
                directUrl: avtocodUrl,
                screenshot: null,
                data: null
            };
        }
    }

    extractDataFromHTML(html, plate) {
        // Создаем временный DOM для парсинга
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Пытаемся найти основные данные об автомобиле
        const carData = {
            directUrl: `https://avtocod.ru/proverkaavto/${plate}`,
            vin: this.extractVIN(doc),
            brand: this.extractBrand(doc),
            year: this.extractYear(doc),
            color: this.extractColor(doc),
            engine: this.extractEngine(doc),
            power: this.extractPower(doc)
        };

        return carData;
    }

    extractVIN(doc) {
        return doc.querySelector('[data-vin]')?.getAttribute('data-vin') || 
               doc.querySelector('.vin-code')?.textContent?.trim() ||
               'Не найден';
    }

    extractBrand(doc) {
        return doc.querySelector('.car-brand')?.textContent?.trim() ||
               doc.querySelector('[class*="brand"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractYear(doc) {
        return doc.querySelector('.car-year')?.textContent?.trim() ||
               doc.querySelector('[class*="year"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractColor(doc) {
        return doc.querySelector('.car-color')?.textContent?.trim() ||
               doc.querySelector('[class*="color"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractEngine(doc) {
        return doc.querySelector('.car-engine')?.textContent?.trim() ||
               doc.querySelector('[class*="engine"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractPower(doc) {
        return doc.querySelector('.car-power')?.textContent?.trim() ||
               doc.querySelector('[class*="power"]')?.textContent?.trim() ||
               'Не указан';
    }

    showLoading() {
        this.hideAll();
        this.loading.classList.remove('hidden');
        this.checkButton.disabled = true;
    }

    showResult(plate, data) {
        this.hideAll();
        this.plateNumber.textContent = plate;
        
        let resultHTML = '';
        
        if (data.directUrl && !data.vin) {
            // Если не удалось распарсить данные, показываем прямую ссылку
            resultHTML = `
                <div class="direct-link">
                    <p>Данные успешно получены с Avtocod!</p>
                    <p>Для просмотра полного отчета перейдите по ссылке:</p>
                    <a href="${data.directUrl}" target="_blank" class="direct-link-btn">
                        📊 Открыть полный отчет на Avtocod
                    </a>
                    <div class="link-info">
                        <small>Ссылка откроется в браузере с полными данными об автомобиле</small>
                    </div>
                </div>
            `;
        } else {
            // Если удалось распарсить некоторые данные
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
        }
        
        this.screenshotContainer.innerHTML = resultHTML;
        this.result.classList.remove('hidden');
        this.checkButton.disabled = false;
    }

    showError(message) {
        this.hideAll();
        this.error.querySelector('p').textContent = message;
        this.error.classList.remove('hidden');
        this.checkButton.disabled = false;
    }

    hideAll() {
        this.loading.classList.add('hidden');
        this.result.classList.add('hidden');
        this.error.classList.add('hidden');
    }

    resetForm() {
        this.hideAll();
        this.plateInput.value = '';
        this.plateInput.focus();
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new CarPlateChecker();
});

// Добавляем стили для данных
const additionalStyles = `
    .direct-link {
        text-align: center;
        padding: 20px;
    }
    
    .direct-link-btn {
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        margin: 15px 0;
        transition: all 0.3s ease;
    }
    
    .direct-link-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .link-info {
        margin-top: 10px;
    }
    
    .parsed-data {
        padding: 10px;
    }
    
    .data-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .data-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .data-item .label {
        font-weight: 600;
        color: #666;
    }
    
    .data-item .value {
        font-weight: 500;
        color: #333;
    }
    
    .full-report {
        text-align: center;
        border-top: 1px solid #e1e5e9;
        padding-top: 20px;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
