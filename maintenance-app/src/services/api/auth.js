import api from "/shared/api-handler.js";

const BASE_URL = "http://localhost:8000";

const AuthService = {
    async login(email, password) {
        try {
            const response = await api.post("/api/v1/auth/login", { email, password }, {
                baseURL: BASE_URL
            });

            if (response.ok && response.data?.success) {
                const { token, user } = response.data.data;

                // حفظ البيانات في localStorage
                localStorage.setItem("token", token);
                localStorage.setItem("user", JSON.stringify(user));

                // إعداد التوكن في الهيدر لجميع الطلبات القادمة
                api.setAuthToken(token);

                return { success: true, user };
            }
            return { success: false, message: response.data?.message || "بيانات الدخول غير صحيحة" };
        } catch (error) {
            return { success: false, message: error.data?.message || "حدث خطأ في الاتصال بالخادم" };
        }
    },

    async logout() {
        try {
            await api.post("/api/v1/auth/logout", {}, { baseURL: BASE_URL });
        } finally {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            api.clearAuthToken();
            window.location.href = "/login";
        }
    },

    getCurrentUser() {
        const user = localStorage.getItem("user");
        return user ? JSON.parse(user) : null;
    }
};

export default AuthService;