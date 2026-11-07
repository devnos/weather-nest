'use strict';
const $ = id => document.getElementById(id);
function weatherInfo(code, day = 1) {
  if (code === 0) return [day ? 'Ясно' : 'Ясная ночь', day ? '☀' : '☾', day ? 'clear' : 'clear night'];
  if ([1, 2].includes(code)) return ['Переменная облачность', day ? '⛅' : '☾', day ? '' : 'night'];
  if (code === 3) return ['Пасмурно', '☁', 'overcast'];
  if ([45, 48].includes(code)) return ['Туман', '≋', 'overcast'];
  if ([51, 53, 55, 56, 57].includes(code)) return ['Морось', '☂', 'rain'];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['Дождь', '☂', 'rain'];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['Снег', '❄', 'snow'];
  if ([95, 96, 99].includes(code)) return ['Гроза', 'ϟ', 'rain'];
  return ['Нет данных о состоянии неба', '◇', 'overcast'];
}
const value = (n, digits = 0) => Number.isFinite(n) ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(n) : '—';
function validPlace(p) { return p && typeof p.name === 'string' && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180; }
function forecastUrl(p) {
  const params = new URLSearchParams({ latitude: p.latitude, longitude: p.longitude, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,surface_pressure', hourly: 'temperature_2m,weather_code,precipitation_probability,is_day', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', timezone: 'auto', wind_speed_unit: 'ms', forecast_days: '7' });
  return 'https://api.open-meteo.com/v1/forecast?' + params;
}
function nextHours(data) { const hour = data.current.time.slice(0, 13); return data.hourly.time.map((time, index) => ({time, index})).filter(x => x.time.slice(0, 13) >= hour).slice(0, 12); }
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function icon(code, day) { const info = weatherInfo(code, day); const node = el('span', 'weather-icon', info[1]); node.setAttribute('role', 'img'); node.setAttribute('aria-label', info[0]); return node; }
let searchController, weatherController, searchVersion = 0, weatherVersion = 0, timer, selected;
async function json(url, controller) {
  const timeout = setTimeout(() => controller.abort('timeout'), 15000);
  try { const response = await fetch(url, { signal: controller.signal }); if (!response.ok) throw new Error('HTTP ' + response.status); const result = await response.json(); if (result.error) throw new Error('API error'); return result; }
  finally { clearTimeout(timeout); }
}
async function search() {
  const query = $('city').value.trim();
  searchController?.abort();
  const version = ++searchVersion;
  $('suggestions').replaceChildren(); $('suggestions').hidden = true;
  if (query.length < 2) { $('search-status').textContent = 'Введите хотя бы 2 буквы'; return; }
  const controller = searchController = new AbortController();
  $('search-status').textContent = 'Ищем город…';
  try {
    const data = await json('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: query, count: '6', language: 'ru', format: 'json' }), controller);
    if (version !== searchVersion) return;
    const places = (data.results || []).filter(validPlace);
    $('search-status').textContent = places.length ? 'Выберите город из списка' : 'Город не найден. Проверьте название или попробуйте латиницей';
    for (const place of places) {
      const button = el('button'); button.type = 'button';
      button.append(el('strong', '', place.name), el('small', '', [place.admin1, place.country].filter(Boolean).join(', ')));
      button.addEventListener('click', () => choose(place)); $('suggestions').append(button);
    }
    $('suggestions').hidden = !places.length;
  } catch { if (version === searchVersion && (!controller.signal.aborted || controller.signal.reason === 'timeout')) $('search-status').textContent = 'Не удалось найти город. Проверьте интернет и нажмите «Найти»'; }
}
function choose(place) {
  clearTimeout(timer); ++searchVersion; searchController?.abort();
  $('suggestions').hidden = true; $('city').value = place.name;
  $('search-status').textContent = 'Можно найти другой город в любой момент';
  loadWeather(place);
}
async function loadWeather(place) {
  if (!validPlace(place)) return;
  selected = place; weatherController?.abort();
  const controller = weatherController = new AbortController(), version = ++weatherVersion;
  $('weather').hidden = true; $('retry').hidden = true;
  $('weather-status').hidden = false; $('weather-status').textContent = 'Загружаем погоду: ' + place.name + '…';
  try {
    const data = await json(forecastUrl(place), controller);
    if (version !== weatherVersion) return;
    if (!data.current || !Array.isArray(data.hourly?.time) || !Array.isArray(data.daily?.time)) throw new Error('Missing forecast');
    render(place, data); $('weather-status').hidden = true; $('weather').hidden = false;
    try { localStorage.setItem('weather-nest-city', JSON.stringify(place)); } catch { /* Private browsing may disable storage */ }
  } catch { if (version === weatherVersion && (!controller.signal.aborted || controller.signal.reason === 'timeout')) { $('weather-status').textContent = 'Погода сейчас недоступна. Проверьте подключение или повторите чуть позже'; $('retry').hidden = false; } }
}
function render(place, data) {
  const c = data.current, info = weatherInfo(c.weather_code, c.is_day);
  $('city-name').textContent = place.name;
  $('place').textContent = [place.admin1, place.country].filter(Boolean).join(', ') || 'Выбранный город';
  const date = new Date(c.time.slice(0, 10) + 'T12:00:00Z');
  $('local-time').textContent = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date) + ' · ' + c.time.slice(11, 16) + ' по местному времени';
  $('temperature').textContent = value(c.temperature_2m); $('condition').textContent = info[0];
  $('feels').textContent = 'Ощущается как ' + value(c.apparent_temperature) + '°';
  $('sky-art').className = 'sky-art ' + info[2];
  $('wind').textContent = value(c.wind_speed_10m, 1); $('humidity').textContent = value(c.relative_humidity_2m);
  $('precipitation').textContent = value(c.precipitation, 1); $('pressure').textContent = value(c.surface_pressure);
  $('hourly').replaceChildren();
  nextHours(data).forEach(({ time, index }, position) => {
    const h = el('div', 'hour'), label = el('time', '', position === 0 ? 'Сейчас' : time.slice(11, 16)); label.dateTime = time;
    h.append(label, icon(data.hourly.weather_code[index], data.hourly.is_day[index]), el('strong', '', value(data.hourly.temperature_2m[index]) + '°'), el('small', '', 'Осадки ' + value(data.hourly.precipitation_probability[index]) + '%'));
    $('hourly').append(h);
  });
  $('daily').replaceChildren();
  data.daily.time.forEach((time, i) => {
    const day = el('div', 'day'), date = new Date(time + 'T12:00:00Z');
    const name = el('div', 'day-name', i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'UTC' }).format(date));
    name.append(el('small', '', new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)));
    const condition = el('div', 'day-condition'); condition.append(icon(data.daily.weather_code[i]), el('span', 'description', weatherInfo(data.daily.weather_code[i])[0]));
    const rain = el('div', 'day-rain', value(data.daily.precipitation_probability_max[i]) + '%'); rain.title = 'Вероятность осадков';
    const temperatures = el('div', 'day-temp'); temperatures.append(el('span', '', value(data.daily.temperature_2m_min[i]) + '°'), el('i', 'temp-bar'), el('strong', '', value(data.daily.temperature_2m_max[i]) + '°'));
    day.append(name, condition, rain, temperatures); $('daily').append(day);
  });
}
if (typeof document !== 'undefined') {
  $('city').addEventListener('input', () => { clearTimeout(timer); searchController?.abort(); ++searchVersion; $('suggestions').hidden = true; $('search-status').textContent = 'Ищем город…'; timer = setTimeout(search, 350); });
  $('search-form').addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); search(); });
  $('city').addEventListener('keydown', event => { if (event.key === 'ArrowDown' && !$('suggestions').hidden) { event.preventDefault(); $('suggestions').firstElementChild?.focus(); } });
  $('suggestions').addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); event.target.nextElementSibling?.focus(); } if (event.key === 'ArrowUp') { event.preventDefault(); (event.target.previousElementSibling || $('city')).focus(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { clearTimeout(timer); ++searchVersion; searchController?.abort(); $('suggestions').hidden = true; $('city').focus(); } });
  document.addEventListener('click', event => { if (!event.target.closest('.search-section')) { clearTimeout(timer); ++searchVersion; searchController?.abort(); $('suggestions').hidden = true; } });
  $('retry').addEventListener('click', () => loadWeather(selected));
  let place = { name: 'Москва', admin1: 'Москва', country: 'Россия', latitude: 55.7522, longitude: 37.6156 };
  try { const stored = JSON.parse(localStorage.getItem('weather-nest-city')); if (validPlace(stored)) place = stored; } catch { /* Use default city when storage is unavailable */ }
  loadWeather(place);
}
if (typeof module !== 'undefined') module.exports = { weatherInfo, value, validPlace, forecastUrl, nextHours };

