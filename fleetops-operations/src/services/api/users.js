import api from "/shared/api-handler.js";

// إعداد الرابط الأساسي (لو مش معموله إعداد جلوبال في ملف تاني)
api.setBaseURL("http://localhost:8000"); 

// 1. جلب المستخدمين
export async function getUsers(filters = {}) {
    try {
        // تجميع الفلاتر ككائن بسيط، والـ api-handler هيحولها لـ Query Params
        const params = {};
        if (filters.role && filters.role.toLowerCase() !== 'all') {
            params.role = filters.role;
        }
        if (filters.search) {
            params.search = filters.search;
        }
        
        // استدعاء نظيف جداً ومختصر
        const { data } = await api.get("/api/v1/users", { params });

        if (data.success) {
            return data.data.data.map(user => ({
                id: user.user_id,
                fullName: user.name,
                email: user.email,
                phone: user.phone_no || '--',
                role: user.role,
                status: user.is_active ? 'active' : 'inactive',
                city: '--'
            })); 
        }
        console.error("Backend Error:", data.message);
        return [];
    } catch (error) {
        console.error("Network Error:", error.data?.message || error.message);
        return [];
    }
}

// 2. إضافة مستخدم جديد
export async function createUser(userData) {
    try {
        // الـ api-handler بيعمل JSON.stringify أوتوماتيك وبيحط الـ Headers
        const { data } = await api.post("/api/v1/users", userData);
        return data; 
    } catch (error) {
        return { success: false, message: error.data?.message || error.message };
    }
}

// 3. تحديث مستخدم
export async function updateUsers(userId, userData) {
    try {
        const { data } = await api.put(`/api/v1/users/${userId}`, userData);
        return data;
    } catch (error) {
        return { success: false, message: error.data?.message || error.message };
    }
}

const UsersApi = {
    getUsers,
    updateUsers,
    createUser
};

export default UsersApi;