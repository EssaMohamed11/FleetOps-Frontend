import api from "../../../shared/api-handler.js"; 
import { SETTINGS_STORAGE_KEY,settingsMockData} from "../storage/settings.js";

// ─── Global Setup ─────────────────────────────────────────────────────────────
// إعداد قاعدة URL وهمية (يمكن تعديله لاحقًا ليتوافق مع API حقيقي)
api.setBaseURL("http://localhost:3000");

// دالة محاكاة تأخير الشبكة لزيادة واقعية التجربة
const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

// ─── API Methods ────────────────────────────────────────────────────────────
// API: GET /api/settings
export async function getSettings() {
    await delay(100);
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsMockData));
        return JSON.parse(JSON.stringify(settingsMockData));
    }
    return JSON.parse(stored);
}


// API: POST/PUT /api/settings (localStorage)
export async function updateSettings(newSettings) {
    await delay(100);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    return { success: true, timestamp: new Date().toISOString() };
}
// Exporting a combined object for easier imports in components(لو حد منكم عاوز ياخد ال settings بردو استعملوا دي )
const SettingsApi = {
    getSettings,
    updateSettings
};

export default SettingsApi;